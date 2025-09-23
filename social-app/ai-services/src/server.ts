import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { captionGenerator, CaptionInput } from './services/captionGenerator.js';
import { contentEditor, EditInput } from './services/contentEditor.js';
import { feedbackService, FeedbackInput } from './services/feedbackService.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 6000);

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-caption-generator' });
});

// POST /api/ai/captions
app.post('/api/ai/captions', async (req, res) => {
  try {
    const input: CaptionInput = req.body;
    
    if (!input.description) {
      return res.status(400).json({ 
        success: false, 
        error: 'description is required' 
      });
    }

    const captions = await captionGenerator.generateCaptions(input);
    
    res.json({
      success: true,
      captions,
      metadata: {
        generatedAt: new Date().toISOString(),
        inputType: input.contentType || 'image',
        hasRawCaption: !!input.rawCaption,
      }
    });

  } catch (error: any) {
    console.error('Caption generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate captions',
    });
  }
});

// POST /api/ai/edit
app.post('/api/ai/edit', async (req, res) => {
  try {
    const input: EditInput = req.body;
    
    if (!input.sourceUrl || !input.description) {
      return res.status(400).json({ 
        success: false, 
        error: 'sourceUrl and description are required' 
      });
    }

    const result = await contentEditor.editContent(input);
    
    res.json({
      success: result.success,
      variants: result.variants,
      originalAnalysis: result.originalAnalysis,
      aiCaptions: result.aiCaptions,
      metadata: {
        processedAt: new Date().toISOString(),
        inputType: input.type,
        formats: input.formats,
        style: input.style,
      },
      error: result.error,
    });

  } catch (error: any) {
    console.error('Content editing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to edit content',
    });
  }
});

// POST /api/ai/feedback
app.post('/api/ai/feedback', async (req, res) => {
  try {
    const input: FeedbackInput = req.body;
    
    if (!input.sourceUrl || !input.caption) {
      return res.status(400).json({ 
        success: false, 
        error: 'sourceUrl and caption are required' 
      });
    }

    const feedback = await feedbackService.generateFeedback(input);
    
    res.json({
      success: true,
      feedback,
      metadata: {
        analyzedAt: new Date().toISOString(),
        contentType: input.type,
        platform: input.platform,
        industry: input.industry,
      }
    });

  } catch (error: any) {
    console.error('Feedback generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate feedback',
    });
  }
});

// GET /api/ai/captions/health - Service health check
app.get('/api/ai/captions/health', (_req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'ai-content-services',
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`AI Content Services listening on http://localhost:${port}`);
});
