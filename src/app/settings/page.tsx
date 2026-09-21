import { getSettings } from "@/lib/data";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Services, threshold, and the details that go on every draft.
        </p>
      </div>
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
