// The web app's own version and start time, for the admin home's Web card (the API can't know them).
// Nothing secret: the same commit is in every page's build. Railway sets the commit on deploys.
const startedAt = new Date().toISOString();

export function GET() {
  return Response.json({ commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null, startedAt });
}
