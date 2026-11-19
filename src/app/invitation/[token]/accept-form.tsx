"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { acceptInvitationAction } from "./actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingLabel="Un instant…">Rejoindre le groupe</SubmitButton>
    </form>
  );
}
