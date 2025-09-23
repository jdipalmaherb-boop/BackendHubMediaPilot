"use client";
import { useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const AI_API = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:6000";

type Asset = { id: string; key: string; url: string; type: "IMAGE"|"VIDEO"|"DOCUMENT"|"OTHER" };
type GeneratedCaption = { objective: string; caption: string; hashtags: string[]; hook: string; cta: string | null };
type FeedbackSuggestion = { area: string; score: number; advice: string; priority: string; examples?: string[] };
type Feedback = { 
  overallScore: number; 
  suggestions: FeedbackSuggestion[]; 
  strengths: string[]; 
  weaknesses: string[]; 
  quickWins: string[];
  engagementPrediction: {
    expectedLikes: string;
    expectedComments: string;
    expectedShares: string;
    viralPotential: string;
  };
};
type EditVariant = { 
  format: string; 
  dimensions: { width: number; height: number }; 
  url: string; 
  steps: { name: string; description: string; estimatedTime: number }[];
  captionOverlay: { text: string; position: string; style: string; color: string; fontSize: number };
  musicSuggestion?: { genre: string; mood: string; tempo: string; description: string };
};

export default function UploadPage() {
  const [orgId, setOrgId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [uploaded, setUploaded] = useState<Asset | null>(null);
  const [description, setDescription] = useState("");
  const [rawCaption, setRawCaption] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  const [captions, setCaptions] = useState<GeneratedCaption[] | null>(null);
  const [selectedCaptionIdx, setSelectedCaptionIdx] = useState<number | null>(null);

  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [editVariants, setEditVariants] = useState<EditVariant[] | null>(null);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null);

  const mediaType = useMemo(() => {
    if (!file) return "OTHER";
    if (file.type.startsWith("image/")) return "IMAGE";
    if (file.type.startsWith("video/")) return "VIDEO";
    return "OTHER";
  }, [file]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !orgId) return;
    setLoading(true);
    setMessage(null);
    setUploaded(null);
    const body = new FormData();
    body.append("orgId", orgId);
    body.append("file", file);
    try {
      const res = await fetch(`${API}/assets/upload`, { method: "POST", body });
      if (!res.ok) throw new Error(`Upload failed ${res.status}`);
      const data = await res.json();
      setUploaded(data);
      setMessage(`Uploaded ${data.key}`);
    } catch (err: any) {
      setMessage(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const onGenerateCaptions = async () => {
    if (!description && !rawCaption) return setMessage("Please add a description or raw caption");
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`${AI_API}/api/ai/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          description: description || rawCaption, 
          rawCaption,
          contentType: mediaType === "VIDEO" ? "video" : "image",
          industry: industry || undefined,
          targetAudience: targetAudience || undefined,
        }),
      });
      if (!res.ok) return setMessage(`Failed: ${res.status}`);
      const data = await res.json();
      setCaptions(data.captions);
      setSelectedCaptionIdx(0);
    } catch (err: any) {
      setMessage(err.message || "Failed to generate captions");
    } finally {
      setLoading(false);
    }
  };

  const onGetFeedback = async () => {
    if (!uploaded) return setMessage("Upload content first");
    const caption = selectedCaptionIdx != null && captions ? captions[selectedCaptionIdx].caption : rawCaption || description;
    const type = mediaType === "VIDEO" ? "video" : "image";
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`${AI_API}/api/ai/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type, 
          sourceUrl: uploaded.url, 
          caption, 
          description,
          industry: industry || undefined,
          targetAudience: targetAudience || undefined,
          platform: "instagram", // Default to Instagram
        }),
      });
      if (!res.ok) return setMessage(`Failed: ${res.status}`);
      const data = await res.json();
      setFeedback(data.feedback);
    } catch (err: any) {
      setMessage(err.message || "Failed to get feedback");
    } finally {
      setLoading(false);
    }
  };

  const onEditContent = async () => {
    if (!uploaded) return setMessage("Upload content first");
    const type = mediaType === "VIDEO" ? "video" : "image";
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`${AI_API}/api/ai/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          type, 
          sourceUrl: uploaded.url, 
          description, 
          rawCaption,
          formats: ["portrait", "square"],
          style: "bold",
          industry: industry || undefined,
          targetAudience: targetAudience || undefined,
        }),
      });
      if (!res.ok) return setMessage(`Failed: ${res.status}`);
      const data = await res.json();
      setEditVariants(data.variants);
      setSelectedVariantIdx(0);
    } catch (err: any) {
      setMessage(err.message || "Failed to edit content");
    } finally {
      setLoading(false);
    }
  };

  const selectedCaptionText = selectedCaptionIdx != null && captions ? captions[selectedCaptionIdx].caption : "";
  const selectedVariantUrl = selectedVariantIdx != null && editVariants ? editVariants[selectedVariantIdx].url : "";

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Upload & Enhance Content</h1>

      <form onSubmit={onSubmit} className="space-y-3 border rounded p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Organization ID"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            required
          />
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="md:col-span-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <textarea className="border rounded px-3 py-2" placeholder="Description / Alt text" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <textarea className="border rounded px-3 py-2" placeholder="Raw caption (optional)" rows={3} value={rawCaption} onChange={(e) => setRawCaption(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Industry (optional)" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Target audience (optional)" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
        </div>
        <button disabled={loading || !file} className="bg-blue-600 text-white rounded px-3 py-2">
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {uploaded && (
        <div className="border rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Uploaded</div>
            <div className="text-sm text-gray-600">{uploaded.key}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={onGenerateCaptions} 
              disabled={loading}
              className="bg-indigo-600 text-white rounded px-4 py-2 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Generating..." : "Generate Captions"}
            </button>
            <button 
              onClick={onGetFeedback} 
              disabled={loading}
              className="bg-emerald-600 text-white rounded px-4 py-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing..." : "Get Feedback"}
            </button>
            <button 
              onClick={onEditContent} 
              disabled={loading}
              className="bg-fuchsia-600 text-white rounded px-4 py-2 hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Editing..." : "Edit Content"}
            </button>
          </div>
        </div>
      )}

      {captions && (
        <div className="border rounded p-4 space-y-3">
          <div className="font-medium">AI-Generated Caption Options</div>
          <div className="grid md:grid-cols-3 gap-3">
            {captions.map((c, idx) => (
              <button 
                key={idx} 
                type="button" 
                onClick={() => setSelectedCaptionIdx(idx)} 
                className={`text-left border rounded p-4 transition-all ${
                  selectedCaptionIdx===idx 
                    ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium uppercase text-gray-600">{c.objective}</div>
                  <div className="text-xs text-gray-500">Hook: "{c.hook}"</div>
                </div>
                <div className="mt-1 text-sm">{c.caption}</div>
                <div className="mt-2 text-xs text-gray-600">{c.hashtags.join(' ')}</div>
                {c.cta && (
                  <div className="mt-2 text-xs font-medium text-blue-600">CTA: {c.cta}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {feedback && (
        <div className="border rounded p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-medium">AI Expert Feedback</div>
            <div className="text-sm">Overall Score: <span className="font-semibold text-lg">{feedback.overallScore}/10</span></div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-green-600 mb-2">Strengths</h4>
              <ul className="text-sm space-y-1">
                {feedback.strengths.map((strength, i) => (
                  <li key={i} className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-red-600 mb-2">Areas to Improve</h4>
              <ul className="text-sm space-y-1">
                {feedback.weaknesses.map((weakness, i) => (
                  <li key={i} className="flex items-center">
                    <span className="text-red-500 mr-2">⚠</span>
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Detailed Suggestions</h4>
            <div className="space-y-3">
              {feedback.suggestions.map((s, i) => (
                <div key={i} className={`p-3 rounded border-l-4 ${
                  s.priority === 'high' ? 'border-red-500 bg-red-50' :
                  s.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{s.area}</span>
                    <span className="text-sm font-semibold">{s.score}/10</span>
                  </div>
                  <p className="text-sm mb-2">{s.advice}</p>
                  {s.examples && s.examples.length > 0 && (
                    <div className="text-xs text-gray-600">
                      <strong>Examples:</strong> {s.examples.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Quick Wins</h4>
            <ul className="text-sm space-y-1">
              {feedback.quickWins.map((win, i) => (
                <li key={i} className="flex items-center">
                  <span className="text-blue-500 mr-2">💡</span>
                  {win}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <h4 className="font-medium mb-2">Engagement Prediction</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Likes</div>
                <div className="font-semibold">{feedback.engagementPrediction.expectedLikes}</div>
              </div>
              <div>
                <div className="text-gray-600">Comments</div>
                <div className="font-semibold">{feedback.engagementPrediction.expectedComments}</div>
              </div>
              <div>
                <div className="text-gray-600">Shares</div>
                <div className="font-semibold">{feedback.engagementPrediction.expectedShares}</div>
              </div>
              <div>
                <div className="text-gray-600">Viral Potential</div>
                <div className={`font-semibold ${
                  feedback.engagementPrediction.viralPotential === 'high' ? 'text-green-600' :
                  feedback.engagementPrediction.viralPotential === 'medium' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {feedback.engagementPrediction.viralPotential.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editVariants && (
        <div className="border rounded p-4 space-y-4">
          <div className="font-medium">AI-Edited Content Variants</div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {editVariants.map((v, idx) => (
              <div 
                key={idx} 
                className={`border rounded-lg p-4 transition-all cursor-pointer ${
                  selectedVariantIdx===idx 
                    ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedVariantIdx(idx)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium capitalize">{v.format}</div>
                  <div className="text-xs text-gray-500">{v.dimensions.width}x{v.dimensions.height}</div>
                </div>
                
                <div className="bg-gray-100 aspect-video rounded flex items-center justify-center mb-3">
                  {mediaType === 'VIDEO' ? (
                    <video src={v.url} controls className="w-full h-full object-contain rounded" />
                  ) : (
                    <img src={v.url} alt="variant" className="w-full h-full object-contain rounded" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs">
                    <div className="font-medium text-gray-600">Caption Overlay:</div>
                    <div className="text-gray-800 truncate">{v.captionOverlay.text}</div>
                    <div className="text-gray-500">
                      {v.captionOverlay.position} • {v.captionOverlay.style} • {v.captionOverlay.color}
                    </div>
                  </div>

                  {v.musicSuggestion && (
                    <div className="text-xs">
                      <div className="font-medium text-gray-600">Music Suggestion:</div>
                      <div className="text-gray-800">{v.musicSuggestion.genre} - {v.musicSuggestion.mood}</div>
                      <div className="text-gray-500">{v.musicSuggestion.description}</div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500">
                    Processing time: {v.steps.reduce((total, step) => total + step.estimatedTime, 0)}s
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(uploaded || selectedCaptionText || selectedVariantUrl) && (
        <div className="border rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">Ready to schedule your optimized content?</div>
            <a
              className="bg-green-600 text-white rounded px-4 py-2 hover:bg-green-700 transition-colors"
              href={`/composer?orgId=${encodeURIComponent(orgId)}${uploaded?`&assetId=${encodeURIComponent(uploaded.id)}`:''}${selectedCaptionText?`&content=${encodeURIComponent(selectedCaptionText)}`:''}${selectedVariantUrl?`&mediaUrl=${encodeURIComponent(selectedVariantUrl)}`:''}${feedback?.overallScore?`&aiScore=${feedback.overallScore}`:''}`}
            >
              Use in Composer →
            </a>
          </div>
          
          <div className="text-xs text-gray-500 space-y-1">
            {selectedCaptionText && (
              <div>✓ Selected caption: "{selectedCaptionText.substring(0, 50)}..."</div>
            )}
            {selectedVariantUrl && (
              <div>✓ Selected edited media variant</div>
            )}
            {feedback && (
              <div>✓ AI feedback score: {feedback.overallScore}/10</div>
            )}
          </div>
        </div>
      )}

      {message && <p className="text-sm text-gray-700">{message}</p>}
    </div>
  );
}


