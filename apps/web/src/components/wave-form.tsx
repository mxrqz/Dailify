import { Loader2, MicIcon, SendHorizontalIcon, StopCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";
import { useAuth } from "@clerk/clerk-react";
import { TaskProps } from "@/types/types";
import { createTaskVoice } from "@/functions/api";

export default function Waveform({ onResponse }: { onResponse: (response: TaskProps[]) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const recordRef = useRef<RecordPlugin | null>(null);

  const { getToken } = useAuth();

  const rootStyles = getComputedStyle(document.documentElement);
  const foregroundColor = rootStyles.getPropertyValue("--foreground").trim();
  const primaryColor = rootStyles.getPropertyValue("--primary").trim();
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);

  const [record, setRecord] = useState<Blob>();

  const startRecording = async () => {
    if (!recordRef.current) return;
    await recordRef.current.startRecording();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (!recordRef.current) return;
    recordRef.current.stopRecording();
    setIsRecording(false);
  };

  // const getResponse = async (token: string, formData: FormData) => {
  //     const response = await fetch('http://localhost:3333/createTaskByVoice', {
  //         method: "POST",
  //         headers: {
  //             Authorization: `Bearer ${token}`
  //         },
  //         body: formData
  //     })

  //     return response
  // }

  const handleSendRequest = async () => {
    if (!record) return;

    setLoading(true);

    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("audio", record);

    const response = await createTaskVoice(token, formData);
    const data = await response.json();

    if (!data) {
      setLoading(false);
      return;
    }

    const tasks: TaskProps[] = data.tasks ?? [];
    onResponse(tasks);

    setLoading(false);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: foregroundColor || primaryColor,
      normalize: true,
      height: 50,
      barWidth: 4,
      barHeight: 1,
      barGap: 2,
      minPxPerSec: 1,
      barRadius: 12,
    });

    // Prefer Opus (tiny for speech); fall back to mp4/AAC on Safari. Low bitrate mono keeps
    // the upload ~5-10x smaller than the MediaRecorder default — accuracy for speech is unaffected.
    const preferredMimeTypes = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
    const mimeType =
      typeof MediaRecorder !== "undefined"
        ? preferredMimeTypes.find((t) => MediaRecorder.isTypeSupported(t))
        : undefined;

    const record = wavesurfer.registerPlugin(
      RecordPlugin.create({
        continuousWaveform: true,
        continuousWaveformDuration: 30,
        renderRecordedAudio: true,
        audioBitsPerSecond: 24000,
        ...(mimeType ? { mimeType } : {}),
      }),
    );

    wavesurferRef.current = wavesurfer;
    recordRef.current = record;

    return () => {
      wavesurfer.destroy();
    };
  }, []);

  useEffect(() => {
    if (!wavesurferRef.current) return;

    wavesurferRef.current?.on("seeking", () => {
      // setIsPlaying(true)
      wavesurferRef.current?.play();
    });

    recordRef.current?.on("record-end", async (end) => {
      setRecord(end);
    });
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="w-full flex gap-3 justify-self-start self-start">
        <div ref={containerRef} className="w-full" />

        <Button
          disabled={loading}
          // onClick={isRecording ? stopRecording : startRecording}
          onClick={record ? handleSendRequest : isRecording ? stopRecording : startRecording}
          className="bg-primary text-white py-2 px-4 size-12 rounded-full"
        >
          {record && !loading && <SendHorizontalIcon className="size-6" />}

          {loading && <Loader2 className="animate-spin size-6" />}

          {isRecording && <StopCircleIcon className="size-6" />}

          {!isRecording && !record && <MicIcon className="size-6" />}
        </Button>
      </div>
    </div>
  );
}
