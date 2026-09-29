import { APPS } from "@hagz/contracts";

// Reached only when the dashboard app isn't installed; otherwise the OS opens the app directly.
export default function ManageFallback() {
  return (
    <main>
      <h1>Open this in {APPS.dashboard.name}</h1>
    </main>
  );
}
