import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IosInstallHint } from "@/components/ios-install-hint";
import { usePwaInstall } from "@/lib/use-pwa-install";
import type { ComponentProps } from "react";

type Props = {
  label?: string;
} & Omit<ComponentProps<typeof Button>, "onClick" | "children">;

export function InstallButton({ label = "Instalar app", ...buttonProps }: Props) {
  const { canInstall, install, iosHint, dismissIosHint } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <>
      <Button type="button" onClick={install} {...buttonProps}>
        <Download className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <IosInstallHint open={iosHint} onClose={dismissIosHint} />
    </>
  );
}
