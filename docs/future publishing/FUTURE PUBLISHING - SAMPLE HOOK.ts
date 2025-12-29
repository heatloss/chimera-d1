const Posts: CollectionConfig = {
  slug: 'posts',
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        // Only trigger if status is Published AND date is not in future
        const isPublished = doc._status === 'published';
        const isReady = new Date(doc.publishDate) <= new Date();

        if (isPublished && isReady) {
           await triggerGitHubBuild(); // Helper function defined below
        }
      }
    ]
  },
  // ... rest of config
};