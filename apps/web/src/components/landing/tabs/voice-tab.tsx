import { copy } from "../copy";
import { VoiceAppWindow } from "../mocks/voice-app-window";
import { VoiceResultCard } from "../mocks/voice-result-card";
import { TabScene } from "../tab-scene";

/** VOICE scene — the voice-capture window (bleeding right) + the structured task floating over it. */
export function VoiceTab({ reduce }: { reduce: boolean }): JSX.Element {
  const tabCopy = copy.features.tabs.voice;
  return (
    <TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
      {/* tarefa criada flutuando à esquerda — "virou tarefa" */}
      <div className="absolute bottom-0 left-16 h-3/5 w-1/2">
        <VoiceResultCard className="h-full" />
      </div>

      {/* captura por voz sangrando à direita — "fala" */}
      <div className="absolute bottom-0 -right-5 w-1/2">
        <VoiceAppWindow reduce={reduce} />
      </div>
    </TabScene>
  );
}
