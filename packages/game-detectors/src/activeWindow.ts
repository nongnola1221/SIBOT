import { execFile } from "node:child_process";
import { platform } from "node:os";

export interface ActiveWindowSnapshot {
  processName: string | null;
  title: string | null;
}

const WINDOWS_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class SibotWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$hwnd = [SibotWin32]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
  [Console]::Out.Write('{"processName":null,"title":null}')
  exit 0
}

$builder = New-Object System.Text.StringBuilder 1024
[SibotWin32]::GetWindowText($hwnd, $builder, $builder.Capacity) | Out-Null

$pid = 0
[SibotWin32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null

$processName = $null
if ($pid -gt 0) {
  try {
    $processName = (Get-Process -Id $pid -ErrorAction Stop).ProcessName
  } catch {
    $processName = $null
  }
}

[pscustomobject]@{
  processName = $processName
  title = $builder.ToString()
} | ConvertTo-Json -Compress
`;

const MAC_FRONTMOST_APP_SCRIPT = `
tell application "System Events"
  name of first application process whose frontmost is true
end tell
`;

const MAC_FRONT_WINDOW_TITLE_SCRIPT = `
tell application "System Events"
  tell (first application process whose frontmost is true)
    try
      value of attribute "AXTitle" of front window
    on error
      ""
    end try
  end tell
end tell
`;

const runCommand = (command: string, args: string[]) =>
  new Promise<string>((resolve, reject) => {
    execFile(command, args, { timeout: 3000, windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(stdout.trim());
    });
  });

const normalizeProcessName = (value: string | null) => {
  if (!value) {
    return null;
  }

  return value.toLowerCase().endsWith(".exe") ? value : `${value}.exe`;
};

const getWindowsActiveWindow = async (): Promise<ActiveWindowSnapshot | null> => {
  try {
    const stdout = await runCommand("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      WINDOWS_SCRIPT
    ]);
    const parsed = JSON.parse(stdout) as ActiveWindowSnapshot;

    return {
      processName: normalizeProcessName(parsed.processName),
      title: parsed.title?.trim() || null
    };
  } catch {
    return null;
  }
};

const getMacActiveWindow = async (): Promise<ActiveWindowSnapshot | null> => {
  try {
    const [processName, title] = await Promise.all([
      runCommand("osascript", ["-e", MAC_FRONTMOST_APP_SCRIPT]),
      runCommand("osascript", ["-e", MAC_FRONT_WINDOW_TITLE_SCRIPT])
    ]);

    return {
      processName: processName || null,
      title: title || null
    };
  } catch {
    return null;
  }
};

export const getActiveWindowSnapshot = async (): Promise<ActiveWindowSnapshot | null> => {
  switch (platform()) {
    case "win32":
      return getWindowsActiveWindow();
    case "darwin":
      return getMacActiveWindow();
    default:
      return null;
  }
};
