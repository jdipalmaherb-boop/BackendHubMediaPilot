import { Router, Request, Response } from 'express';
import { z } from 'zod';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import { prisma } from '../lib/prisma.js';
import { generateVideoTips } from '../services/tipsGenerator.js';
import { transcribeAudio } from '../services/aiTranscribe.js';
import { log } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/videos/:id
 * Get full video asset details (owner only)
 */
router.get('/:id', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token',
      });
    }

    const video = await prisma.videoAsset.findFirst({
      where: {
        id,
        ownerId: userId,
      },
    });

    if (!video) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Video asset not found or access denied',
      });
    }

    res.json(video);
  } catch (error) {
    log.error({
      type: 'video_fetch_error',
      error: error instanceof Error ? error.message : 'unknown',
      videoId: req.params.id,
    }, 'Failed to fetch video asset');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch video asset',
    });
  }
});

/**
 * GET /api/videos/:id/status
 * Get video processing status (lightweight, for polling)
 */
router.get('/:id/status', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token',
      });
    }

    const video = await prisma.videoAsset.findFirst({
      where: {
        id,
        ownerId: userId,
      },
      select: {
        id: true,
        status: true,
        meta: true,
      },
    });

    if (!video) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Video asset not found or access denied',
      });
    }

    const meta = (video.meta as Record<string, unknown> | null) || {};
    const progress = meta.progress as number | undefined;
    const error = meta.error as string | undefined;

    res.json({
      status: video.status,
      progress,
      error,
    });
  } catch (error) {
    log.error({
      type: 'video_status_error',
      error: error instanceof Error ? error.message : 'unknown',
      videoId: req.params.id,
    }, 'Failed to fetch video status');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch video status',
    });
  }
});

/**
 * POST /api/videos/:id/tips
 * Generate AI marketing tips based on video transcript
 */
router.post('/:id/tips', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token',
      });
    }

    const video = await prisma.videoAsset.findFirst({
      where: {
        id,
        ownerId: userId,
      },
    });

    if (!video) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Video asset not found or access denied',
      });
    }

    const meta = (video.meta as Record<string, unknown> | null) || {};
    let transcript = meta.transcript as string | undefined;

    // If transcript not in meta, try to get from VTT file or re-transcribe
    if (!transcript && video.vttUrl) {
      // TODO: Download and parse VTT to extract text
      // For now, we'll need to re-transcribe if missing
      transcript = undefined;
    }

    // If still no transcript, attempt to re-transcribe (requires original video)
    if (!transcript && video.originalUrl) {
      try {
        // This would require downloading the video and transcribing
        // For now, return an error suggesting the video needs processing first
        return res.status(400).json({
          error: 'Transcript Not Available',
          message: 'Video transcript not found. Please ensure video processing with captions is complete.',
        });
      } catch (error) {
        log.error({
          type: 'transcription_error',
          error: error instanceof Error ? error.message : 'unknown',
          videoId: id,
        }, 'Failed to transcribe video for tips');
        return res.status(500).json({
          error: 'Transcription Failed',
          message: 'Failed to generate transcript for tips',
        });
      }
    }

    if (!transcript) {
      return res.status(400).json({
        error: 'Transcript Not Available',
        message: 'Video transcript is required to generate tips. Please process the video with captions enabled.',
      });
    }

    // Get context from request or use defaults
    const { context, industry, targetAudience, platform } = req.body;

    const tips = await generateVideoTips({
      transcript,
      context: context || 'Video content',
      industry: industry || 'General',
      targetAudience,
      platform,
    });

    res.json({
      videoId: id,
      tips,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error({
      type: 'tips_generation_error',
      error: error instanceof Error ? error.message : 'unknown',
      videoId: req.params.id,
    }, 'Failed to generate video tips');
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to generate tips',
    });
  }
});

/**
 * POST /api/videos/:id/clip-ideas
 * Generate suggested short-form clip ideas based on transcript
 */
router.post('/:id/clip-ideas', verifyFirebaseToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.uid;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token',
      });
    }

    const video = await prisma.videoAsset.findFirst({
      where: {
        id,
        ownerId: userId,
      },
    });

    if (!video) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Video asset not found or access denied',
      });
    }

    const meta = (video.meta as Record<string, unknown> | null) || {};
    const transcript = meta.transcript as string | undefined;

    if (!transcript) {
      return res.status(400).json({
        error: 'Transcript Not Available',
        message: 'Video transcript is required to generate clip ideas.',
      });
    }

    // TODO: Implement clip idea generation using GPT
    // This would analyze the transcript and suggest:
    // - Timestamp ranges for clips
    // - Suggested titles
    // - Hook suggestions for each clip
    // For now, return a placeholder response

    res.json({
      videoId: id,
      clips: [],
      message: 'Clip idea generation coming soon',
    });
  } catch (error) {
    log.error({
      type: 'clip_ideas_error',
      error: error instanceof Error ? error.message : 'unknown',
      videoId: req.params.id,
    }, 'Failed to generate clip ideas');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate clip ideas',
    });
  }
});

export default router;

