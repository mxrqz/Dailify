import { useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { createTaskVoice } from "@/functions/api";
import { appTimeZone } from "@/functions/zone";
import { useShowCreated } from "@/hooks/useCreateTask";
import { useQuotas } from "@/hooks/useQuotas";

// Cortesia, não controle: quem limita o custo é o cap de 512 KB no servidor. Parar aqui só evita
// que uma fala longa vire um 413 com a gravação perdida.
const MAX_RECORDING_MS = 60_000;
// Opus é minúsculo pra fala; o Safari cai no mp4/AAC.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];

export const voiceSupported = (): boolean =>
  typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

/** Grava, manda pro servidor (que transcreve e cria) e põe as tarefas na tela, com Desfazer. */
export function useVoiceCreate(onCreated?: () => void) {
  const { getToken } = useAuth();
  const { bumpUsage } = useDailify();
  const showCreated = useShowCreated();
  const quotas = useQuotas();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "recording" | "sending">("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const cap = useRef<ReturnType<typeof setTimeout>>();

  const send = async (audio: Blob) => {
    setState("sending");
    try {
      const token = await getToken();
      if (!token) return;
      const form = new FormData();
      form.append("audio", audio);
      form.append("timezone", appTimeZone());
      const { tasks: created, response, error } = await createTaskVoice(token, form);
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
          : copy.voice.createdMany.replace("{n}", String(created.length)),
      );
      onCreated?.();
    } finally {
      setState("idle");
    }
  };

  const stop = () => {
    clearTimeout(cap.current);
    recorder.current?.stop();
    recorder.current = null;
  };

  const start = async () => {
    if (quotas.states.ai.exhausted) {
      toast(copy.voice.limitReached, {
        description: copy.voice.limitReachedHint,
        action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
      });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error(copy.voice.micDenied, { description: copy.voice.micDeniedHint });
      return;
    }

    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, { audioBitsPerSecond: 24_000, mimeType });
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => chunks.push(event.data);
    rec.onstop = () => {
      // Solta o microfone: sem isso o indicador de gravação do navegador fica aceso.
      for (const track of stream.getTracks()) track.stop();
      void send(new Blob(chunks, { type: rec.mimeType }));
    };
    rec.start();
    recorder.current = rec;
    setState("recording");
    cap.current = setTimeout(() => {
      stop();
      toast.message(copy.voice.maxLength);
    }, MAX_RECORDING_MS);
  };

  return { state, start, stop };
}
