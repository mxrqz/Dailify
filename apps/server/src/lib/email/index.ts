import type { Env } from "../../index";
import { sendWithCloudflare } from "./providers/cloudflare";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Um provedor por arquivo em `providers/`: trocar (ex.: Resend, se o beta do Cloudflare falhar) é esta linha. */
export const sendEmail = (env: Env, mail: Mail): Promise<void> => sendWithCloudflare(env, mail);
