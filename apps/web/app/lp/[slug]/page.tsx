import type { Metadata } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getLanding(slug: string) {
  const res = await fetch(`${API}/api/landing/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function LandingPage({ params }: { params: { slug: string } }) {
  const data = await getLanding(params.slug);
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-semibold">Not found</h1>
          <p className="text-gray-600">This landing page does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{data.headline}</h1>
        <p className="mt-4 text-lg text-gray-600">{data.subtext}</p>
        <div className="mt-8">
          <a href={data.ctaUrl} className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md">
            {data.ctaText}
          </a>
        </div>
      </header>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getLanding(params.slug);
  return {
    title: data ? data.headline : 'Landing Page',
    description: data ? data.subtext : undefined,
  };
}





