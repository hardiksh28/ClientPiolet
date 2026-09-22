import { getSettings } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";
import { GmailConnect } from "@/components/gmail-connect";
import { GroqStatus } from "@/components/groq-status";
import { AutomationSettings } from "@/components/automation-settings";
import { isGmailConfigured } from "@/lib/gmail/oauth";
import { isGroqConfigured } from "@/lib/ai/groq";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const settings = getSettings();
  const params = await searchParams;
  const justConnected = params.gmail_connected === "1";
  const error = typeof params.gmail_error === "string" ? params.gmail_error : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Services, threshold, and the details that go on every draft.
        </p>
      </div>

      <GroqStatus configured={isGroqConfigured()} />

      <GmailConnect
        configured={isGmailConfigured()}
        connectedEmail={settings.gmailConnectedEmail}
        justConnected={justConnected}
        error={error}
      />

      <AutomationSettings
        enabled={settings.automationEnabled}
        intervalMinutes={settings.automationIntervalMinutes}
        lastAutoRunAt={settings.lastAutoRunAt}
      />

      <SettingsForm
        initial={{
          services: JSON.parse(settings.services),
          countries: JSON.parse(settings.countries),
          minScore: settings.minScore,
          dailyLimit: settings.dailyLimit,
          portfolioUrl: settings.portfolioUrl,
          senderName: settings.senderName,
        }}
      />
    </div>
  );
}
