import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { API_ERROR } from "@dailify/shared";
import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { createTaskVoice } from "@/functions/api";
import { fill } from "@/functions/functions";
import { appTimeZone } from "@/functions/zone";
import { setCreditsTray } from "@/hooks/useCreditsTray";
import { useShowCreated } from "@/hooks/useCreateTask";
import { useQuotas } from "@/hooks/useQuotas";

// Cortesia, não controle: quem limita o custo é o cap de 512 KB no servidor. Parar aqui só evita
// que uma fala longa vire um 413 com a gravação perdida.
export const MAX_RECORDING_MS = 60_000;
// Opus é minúsculo pra fala; o Safari cai no mp4/AAC.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];

export const voiceSupported = (): boolean =>
  typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Grava, manda pro servidor (que transcreve e cria) e põe as tarefas na tela, com Desfazer.
 * `analyser` alimenta a onda ao vivo; `cancel` solta o microfone sem enviar. `onAudio` takes the
 * recording instead (the Mew chat), while the state stays "sending".
 */
export function useVoiceCreate(onCreated?: () => void, onAudio?: (audio: Blob) => Promise<void>) {
  const { bumpUsage } = useDailify();
  const showCreated = useShowCreated();
  const quotas = useQuotas();
  const [state, setState] = useState<"idle" | "recording" | "sending">("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const cap = useRef<ReturnType<typeof setTimeout>>();
  // O pedido de permissão leva segundos; um segundo toque abriria outro microfone, que ninguém solta.
  const starting = useRef(false);
  const discard = useRef(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const send = async (audio: Blob) => {
    setState("sending");
    try {
      if (onAudio) return await onAudio(audio);
      const form = new FormData();
      form.append("audio", audio);
      form.append("timezone", appTimeZone());
      const { tasks: created, response, error } = await createTaskVoice(form);
      if (error?.code === API_ERROR.aiExhausted) {
        setCreditsTray(true);
        return;
      }
      if (error) {
        toast.error(copy.voice.error, { description: error.message });
        return;
      }
      bumpUsage("ai");
      if (!created.length) {
        toast.message(response || copy.voice.nothing);
        return;
      }

      showCreated(
        created,
        created.length === 1
          ? copy.voice.createdOne
          : fill(copy.voice.createdMany, { n: created.length }),
      );
      onCreated?.();
    } finally {
      setState("idle");
    }
  };

  // Só refs: estáveis, então o efeito abaixo roda no desmonte e em mais nenhum render.
  const stop = useCallback(() => {
    clearTimeout(cap.current);
    recorder.current?.stop();
    recorder.current = null;
  }, []);

  const cancel = useCallback(() => {
    discard.current = true;
    stop();
  }, [stop]);

  // A folha fechou (Esc, toque fora) no meio da gravação: descarta, não cria nada às cegas.
  useEffect(() => cancel, [cancel]);

  const start = async () => {
    if (starting.current || recorder.current) return;
    if (quotas.states.ai.exhausted) {
      setCreditsTray(true);
      return;
    }

    let stream: MediaStream;
    starting.current = true;
    discard.current = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error(copy.voice.micDenied, { description: copy.voice.micDeniedHint });
      return;
    } finally {
      starting.current = false;
    }
    // Cancelled during the permission prompt: there was no recorder for `cancel` to stop.
    if (discard.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    // A onda é enfeite: sem Web Audio a gravação segue igual, só sem ela.
    let audio: AudioContext | undefined;
    try {
      audio = new AudioContext();
      const node = audio.createAnalyser();
      node.fftSize = 256;
      audio.createMediaStreamSource(stream).connect(node);
      setAnalyser(node);
    } catch {
      audio = undefined;
    }

    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, { audioBitsPerSecond: 24_000, mimeType });
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => chunks.push(event.data);
    rec.onstop = () => {
      // Solta o microfone: sem isso o indicador de gravação do navegador fica aceso.
      for (const track of stream.getTracks()) track.stop();
      void audio?.close();
      setAnalyser(null);
      if (discard.current) setState("idle");
      else void send(new Blob(chunks, { type: rec.mimeType }));
    };
    rec.start();
    recorder.current = rec;
    setState("recording");
    cap.current = setTimeout(() => {
      stop();
      toast.message(copy.voice.maxLength);
    }, MAX_RECORDING_MS);
  };

  return { state, start, stop, cancel, analyser };
}
