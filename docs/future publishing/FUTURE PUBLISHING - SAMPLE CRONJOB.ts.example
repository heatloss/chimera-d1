export default {
  // ... existing fetch handler ...

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  }
}

async function handleCron(env) {
  const payload = await getPayload({ config: configPromise });

  // Find drafts ready to go live
  const readyToPublish = await payload.find({
    collection: 'posts',
    where: {
      and: [
        { _status: { equals: 'draft' } },
        { publishDate: { less_than_equal: new Date().toISOString() } }
      ]
    }
  });

  if (readyToPublish.totalDocs > 0) {
    // Promote them
    for (const doc of readyToPublish.docs) {
      await payload.update({
        collection: 'posts',
        id: doc.id,
        data: { _status: 'published' }
      });
    }
    // Trigger Build ONCE
    await triggerGitHubBuild(env);
  }
}

// Helper: Fire the Webhook
async function triggerGitHubBuild(env) {
  await fetch(
    `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'Cloudflare-Worker'
      },
      body: JSON.stringify({ event_type: 'cms-publish' })
    }
  );
}