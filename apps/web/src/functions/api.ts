import type { Task, TaskInput, Permissions, PaymentDetails, Invoice } from "@dailify/shared";
import { apiURL } from "@/consts/conts";

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(init.headers ?? {}),
  },
});

export async function getTasksForMonth(token: string, month: Date): Promise<Task[]> {
  const m = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const res = await fetch(`${apiURL}/tasks?month=${m}`, authed(token));
  if (!res.ok) return [];
  const data = await res.json();
  return data.tasks ?? [];
}

export async function createTask(
  token: string,
  input: TaskInput,
): Promise<{ task?: Task; error?: string }> {
  const res = await fetch(
    `${apiURL}/tasks`,
    authed(token, { method: "POST", body: JSON.stringify(input) }),
  );
  return res.json();
}

export async function updateTask(
  token: string,
  id: string,
  patch: Partial<TaskInput>,
): Promise<{ task?: Task; error?: string }> {
  const res = await fetch(
    `${apiURL}/tasks/${id}`,
    authed(token, { method: "PATCH", body: JSON.stringify(patch) }),
  );
  return res.json();
}

export async function completeTask(
  token: string,
  id: string,
): Promise<{ task?: Task; error?: string }> {
  const res = await fetch(`${apiURL}/tasks/${id}/complete`, authed(token, { method: "POST" }));
  return res.json();
}

export async function deleteTask(token: string, id: string): Promise<void> {
  await fetch(`${apiURL}/tasks/${id}`, authed(token, { method: "DELETE" }));
}

export async function createTaskVoice(token: string, formData: FormData): Promise<Response> {
  return fetch(`${apiURL}/tasks/voice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

export async function getPermissions(token: string): Promise<Permissions | undefined> {
  const res = await fetch(`${apiURL}/permissions`, authed(token));
  if (!res.ok) return undefined;
  return res.json();
}

export async function getPaymentDetails(token: string): Promise<PaymentDetails | null> {
  const res = await fetch(`${apiURL}/billing/payment-details`, authed(token));
  if (!res.ok) return null;
  return res.json();
}

export async function getInvoices(token: string): Promise<Invoice[]> {
  const res = await fetch(`${apiURL}/billing/invoices`, authed(token));
  if (!res.ok) return [];
  return res.json();
}

export async function checkout(
  token: string,
  productName: string,
): Promise<{ url: string | null }> {
  const res = await fetch(
    `${apiURL}/billing/checkout`,
    authed(token, { method: "POST", body: JSON.stringify({ productName }) }),
  );
  if (!res.ok) return { url: null };
  return res.json();
}

export async function billingPortal(token: string): Promise<{ url: string | null }> {
  const res = await fetch(`${apiURL}/billing/portal`, authed(token));
  if (!res.ok) return { url: null };
  return res.json();
}
