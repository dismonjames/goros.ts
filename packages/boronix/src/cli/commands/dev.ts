import { initUiSettings } from "../ui/terminal"
import { startDevSupervisor, type DevSupervisorOptions } from "../../dev/supervisor"
import { setBoronixMode } from "../../core/mode"

export async function devCommand(root: string, options: Omit<DevSupervisorOptions, "root"> = {}): Promise<void> {
  setBoronixMode("development")
  initUiSettings({ plain: options.plain, noColor: options.noColor })
  await startDevSupervisor({ root, ...options })
}
