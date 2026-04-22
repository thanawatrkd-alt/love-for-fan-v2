import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // AI Chat with Manus LLM
  ai: router({
    chat: publicProcedure
      .input(z.object({
        message: z.string(),
        systemPrompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const systemPrompt = input.systemPrompt || "You are a helpful and friendly assistant. Respond in Thai language.";

        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: input.message },
            ],
          });

          return {
            success: true,
            reply: result.choices[0]?.message?.content || "ไม่สามารถได้รับคำตอบ",
          };
        } catch (error) {
          console.error("LLM error:", error);
          throw error;
        }
      }),
  }),

  // Love for Fan config management
  love: router({
    saveConfig: publicProcedure
      .input(z.object({
        mainTitle: z.string().optional(),
        botName: z.string().optional(),
        anniversaryDate: z.string().optional(),
        customMessage: z.string().optional(),
        botGreeting: z.string().optional(),
        spotifyUrl: z.string().optional(),
        cmd1Text: z.string().optional(),
        cmd2Text: z.string().optional(),
        cmd3Text: z.string().optional(),
        aiSystemPrompt: z.string().optional(),
        photos: z.array(z.string()).optional(),
        videoUrl: z.string().optional(),
        musicUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          // Get GitHub token from environment
          const githubToken = process.env.GITHUB_TOKEN;
          if (!githubToken) {
            console.warn('GITHUB_TOKEN not set, config saved to localStorage only');
            return { success: true, savedToGitHub: false };
          }

          const owner = 'thanawatrkd-alt';
          const repo = 'love-for-fan-v2';
          const branch = 'main';
          const filePath = 'docs/config.json';

          // Get current file SHA
          const getResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            {
              headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          );

          let sha = null;
          if (getResponse.ok) {
            const data = await getResponse.json();
            sha = data.sha;
          }

          // Prepare content
          const content = JSON.stringify(input, null, 2);
          const encodedContent = Buffer.from(content).toString('base64');

          // Update file on GitHub
          const updateResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `Update Love for Fan config - ${new Date().toLocaleString('th-TH')}`,
                content: encodedContent,
                branch: branch,
                sha: sha,
              }),
            }
          );

          if (!updateResponse.ok) {
            const error = await updateResponse.json();
            console.error('GitHub API error:', error);
            return { success: false, error: error.message || 'Failed to save to GitHub' };
          }

          return { success: true, savedToGitHub: true };
        } catch (error) {
          console.error('Error saving config:', error);
          return { success: false, error: String(error) };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
