export type MarketingTemplate = {
  id: string;
  name: string;
  recommendedObjective: 'LEAD_GENERATION' | 'CONVERSIONS';
  hookFramework: string[];
  copyFlow: Array<{
    label: string;
    guidance: string;
    examples: string[];
  }>;
  budgetPlan: {
    startingBudget: string;
    scaleRule: string;
    optimizationNotes: string[];
  };
  targetAudiences: Array<{
    label: string;
    description: string;
    tactics: string[];
  }>;
  timeline: Array<{
    phase: string;
    duration: string;
    focus: string;
    kpis: string[];
  }>;
  kpiNorthStar: string;
  resources: string[];
};

export const marketingTemplates: MarketingTemplate[] = [
  {
    id: 'direct-offer-hormozi',
    name: 'Direct Offer Conversion Blitz',
    recommendedObjective: 'CONVERSIONS',
    hookFramework: [
      'Hook: 4-second pattern interrupt that calls out the dream outcome + timeline',
      'Pain: Quantify the current cost of inaction with a sharp stat or story',
      'Offer: Stack value > scarcity > risk reversal (guarantee, bonus, deadline)',
      'CTA: Single, crystal-clear command with urgency',
    ],
    copyFlow: [
      {
        label: 'Hook',
        guidance: 'Lead with the boldest promise, time-bound, and aimed at status or money.',
        examples: [
          '“Steal our 14-day closing script that booked 37 sales calls last week.”',
          '“Turn 3 client testimonials into $50K in 21 days—here’s the template.”',
        ],
      },
      {
        label: 'Pain Point',
        guidance: 'Expose the opportunity cost or hidden expense of staying stuck.',
        examples: [
          '“If each no-show costs $320, yesterday burnt $1,280. Fix it in one afternoon.”',
          '“Your competitors are retargeting your traffic while you wait for referrals.”',
        ],
      },
      {
        label: 'Offer Stack',
        guidance: 'Bullet the deliverables, add one surprise bonus, and introduce a risk-reversal.',
        examples: [
          '“Get the proven landing page, 7-email follow-up, and the objection-handling sheet. If it doesn’t convert, we rebuild it free.”',
        ],
      },
      {
        label: 'CTA',
        guidance: 'One action, time constrained. Reinforce the guarantee.',
        examples: ['“Claim the offer before Friday—calendar link inside.”'],
      },
    ],
    budgetPlan: {
      startingBudget: '$150/day split 70% acquisition, 30% retargeting',
      scaleRule: 'Increase top performer by 20% after 3 consecutive profitable days (ROAS > 2.5).',
      optimizationNotes: [
        'Kill any ad with CPA > 1.5x target after 1,500 impressions.',
        'Duplicate winners into CBO with manual bids once you have 3+ conversions/day.',
      ],
    },
    targetAudiences: [
      {
        label: 'Cold Dream Buyer',
        description: 'Broader interest targeting layered with behaviors that signal intent.',
        tactics: [
          'Meta: Interest stack (industry authority + problem awareness keyword).',
          'Lookalike 1% from paying customers.',
        ],
      },
      {
        label: 'Warm Engagers',
        description: 'People who watched 50%+ of videos or hit high-intent pages.',
        tactics: ['Video view audiences (30 days)', 'Website visitors with product view (14 days)'],
      },
      {
        label: 'Hot Buyers',
        description: 'Cart abandoners or demo-booking drop-offs.',
        tactics: ['Dynamic product retargeting', 'Email list uploads synced weekly'],
      },
    ],
    timeline: [
      {
        phase: 'Day 0-3: Launch',
        duration: '72 hours',
        focus: 'Deploy 3 hooks + 2 offers, monitor CPM and CPC.',
        kpis: ['CPM <$18', 'CTR > 1.8%'],
      },
      {
        phase: 'Day 4-7: Optimize',
        duration: '4 days',
        focus: 'Cull underperformers, test new hooks against the best offer.',
        kpis: ['CPA within 1.2x target', 'ROAS > 2.0'],
      },
      {
        phase: 'Week 2-3: Scale',
        duration: '14 days',
        focus: 'Increase budgets, rotate fresh creatives to prevent fatigue.',
        kpis: ['Maintain ROAS > 2.5', 'Daily conversions growing 15% week over week'],
      },
    ],
    kpiNorthStar: 'Customer acquisition cost compared to lifetime value (target CAC < 25% LTV).',
    resources: [
      'Offer architecture worksheet',
      'Risk-reversal guarantee swipe file',
      'Hormozi $100M Offers checklist',
    ],
  },
  {
    id: 'lead-magnet-funnel-sabri',
    name: 'Lead Magnet Nurture Funnel',
    recommendedObjective: 'LEAD_GENERATION',
    hookFramework: [
      'Hook: Lead with the predictable transformation + minimal effort promise.',
      'Pain: Contrast current frustration against future certainty.',
      'Offer: “Gift” style magnet + nurturing sequence preview.',
      'CTA: “Download & unlock” with a time-limited bonus consult.',
    ],
    copyFlow: [
      {
        label: 'Hook',
        guidance: 'Call out the exact persona and dangle the shortcut they crave.',
        examples: [
          '“7 Plug-and-Play ad angles that filled 43 yoga classes in 19 days.”',
          '“Download the 5-email sequence that sold $120K of high-ticket coaching.”',
        ],
      },
      {
        label: 'Pain Relief',
        guidance: 'Show how the asset removes their biggest bottleneck.',
        examples: [
          '“Stop guessing. Just copy/paste these ads into your account and launch.”',
          '“Never stare at a blank page again—the scripts and shots are done for you.”',
        ],
      },
      {
        label: 'Magnet Value',
        guidance: 'Bullet what they get, highlight the first quick win.',
        examples: [
          '“Inside: ready-to-run ads, retargeting framework, and the 48-hour follow-up playbook.”',
        ],
      },
      {
        label: 'CTA',
        guidance: 'Push immediate action with “download now” + follow-up teaser.',
        examples: ['“Grab the vault, then watch your inbox for the automation map.”'],
      },
    ],
    budgetPlan: {
      startingBudget: '$80/day split 60% cold, 40% warm retargeting',
      scaleRule: 'Scale 15% every 2 days when lead cost is within 10% of target.',
      optimizationNotes: [
        'If CPL spikes 30%+, rotate new hook video, keep the offer static.',
        'Build retargeting nurture with testimonial carousels and behind-the-scenes reels.',
      ],
    },
    targetAudiences: [
      {
        label: 'Problem-Aware Cold',
        description: 'Interests centered on marketing, growth, or the specific niche pain point.',
        tactics: [
          'Interest targeting + lookalike from lead magnet downloaders',
          'Keyword intent groups (Meta Advantage Detailed Targeting)'],
      },
      {
        label: 'Warm Engagement',
        description: 'People who engaged with long-form content or podcasts.',
        tactics: ['Video viewers 50% (30 days)', 'Instagram engager audience'],
      },
      {
        label: 'Hot Nurture',
        description: 'Leads in CRM without booked call.',
        tactics: ['Upload lead list weekly', 'Sync HubSpot or GoHighLevel segments'],
      },
    ],
    timeline: [
      {
        phase: 'Week 1',
        duration: '7 days',
        focus: 'Audience testing (3 hooks x 2 thumbnails).',
        kpis: ['CPL < $9', 'Landing page CVR > 35%'],
      },
      {
        phase: 'Week 2',
        duration: '7 days',
        focus: 'Email follow-up optimization and retargeting creatives.',
        kpis: ['Follow-up open rate > 45%', 'Click-to-book rate > 12%'],
      },
      {
        phase: 'Week 3-4',
        duration: '14 days',
        focus: 'Scaling budgets + webinar/live call nurture.',
        kpis: ['Booked calls per week +25%', 'SQL-to-customer conversion > 20%'],
      },
    ],
    kpiNorthStar: 'Cost per qualified lead (target CPL <= $12 with 20% book rate).',
    resources: [
      'Sabri Suby acquisition email cadence',
      'High-converting landing page wireframe',
      'Lead magnet fulfillment checklist',
    ],
  },
  {
    id: 'free-trial-rapid-capture',
    name: 'Free Trial Rapid-Capture Sprint',
    recommendedObjective: 'CONVERSIONS',
    hookFramework: [
      'Hook: “Get X result in Y days free”—demo the aha moment.',
      'Pain: Highlight the friction the product removes.',
      'Offer: Free trial + concierge onboarding + success guarantee.',
      'CTA: “Start free today” emphasizing speed to value.',
    ],
    copyFlow: [
      {
        label: 'Hook',
        guidance: 'Show them the future state within seconds, ideally with before/after shots.',
        examples: [
          '“Spin up 5 ad variants in 3 minutes—no editor required.”',
          '“Replace 6 hours of editing with one click. Free for 14 days.”',
        ],
      },
      {
        label: 'Friction Killer',
        guidance: 'Eliminate the typical objections to trying the product.',
        examples: [
          '“We preload your first project and guide the launch on a kickoff call.”',
          '“Keep all assets even if you cancel—zero credit card required.”',
        ],
      },
      {
        label: 'Proof Stack',
        guidance: 'Mini testimonial + metric + brand logos.',
        examples: [
          '“Agencies using this cut production time 73%. See the template.”',
        ],
      },
      {
        label: 'CTA',
        guidance: 'Make activation sound like the easiest yes.',
        examples: ['“Tap start, launch your first automation before lunch.”'],
      },
    ],
    budgetPlan: {
      startingBudget: '$120/day across 2 creatives (UGC + demo)',
      scaleRule: 'If trial-to-paid conversion > 18%, increase spend 25% until CPA ceiling hit.',
      optimizationNotes: [
        'Enable campaign budget optimization after first 20 conversions.',
        'Feed retargeting with product walkthrough clips and customer wins.',
      ],
    },
    targetAudiences: [
      {
        label: 'In-Market SaaS Users',
        description: 'Users of complementary tools or competitors.',
        tactics: ['Interest in SaaS tools + behavior “Business page admins”', 'Lookalikes from paying subscribers'],
      },
      {
        label: 'Lifecycle Retargeting',
        description: 'Website visitors and freemium users within 30 days.',
        tactics: ['Website retargeting stacked with add-to-cart event', 'Email list of inactive accounts'],
      },
      {
        label: 'Activation Push',
        description: 'Trial sign-ups without onboarding completion.',
        tactics: ['Custom event audiences (trial_started but not activated)', 'SMS & email synced remarketing'],
      },
    ],
    timeline: [
      {
        phase: 'Week 0',
        duration: 'Pre-launch 3 days',
        focus: 'Install conversion API, create walkthrough assets.',
        kpis: ['Pixel firing for key events', 'Creative variations ready'],
      },
      {
        phase: 'Week 1',
        duration: '7 days',
        focus: 'Spray hooks, identify hero creatives.',
        kpis: ['Trial CPA <= $20', 'Landing CVR > 28%'],
      },
      {
        phase: 'Week 2-3',
        duration: '14 days',
        focus: 'Onboarding nurture and paid retargeting to activate trials.',
        kpis: ['Activation rate > 60%', 'Trial-to-paid > 18%'],
      },
    ],
    kpiNorthStar: 'Trial-to-paid conversion rate with CAC payback < 60 days.',
    resources: [
      'Onboarding email drip wireframe',
      'Trial activation call script',
      'Product demo storyboard template',
    ],
  },
  {
    id: 'local-awareness-appointment',
    name: 'Local Awareness Appointment Engine',
    recommendedObjective: 'LEAD_GENERATION',
    hookFramework: [
      'Hook: Hyper-local headline with social proof (“As seen on [local landmark]”).',
      'Pain: Immediate problem solved (aches, time wasted, money lost).',
      'Offer: Limited slots + community guarantee (donation, neighbor discounts).',
      'CTA: “Book your visit” with easy scheduling.',
    ],
    copyFlow: [
      {
        label: 'Hook',
        guidance: 'Lead with neighborhood credibility + fast benefit.',
        examples: [
          '“Summerville parents, fix your teen’s posture in 10 minutes—free first consult.”',
          '“Austin founders: get your content batch-filmed this Saturday. 5 seats.”',
        ],
      },
      {
        label: 'Community Proof',
        guidance: 'Testimonials from recognizable locals or stats.',
        examples: [
          '“Trusted by 312 local families. Voted #1 in the city for 3 years running.”',
        ],
      },
      {
        label: 'Offer',
        guidance: 'Promote the appointment slot scarcity + incentive.',
        examples: [
          '“Book today, get the recovery kit valued at $79.”',
        ],
      },
      {
        label: 'CTA',
        guidance: 'Drive to instant booking with a friendly tone.',
        examples: ['“Tap to claim your slot—see you this week!”'],
      },
    ],
    budgetPlan: {
      startingBudget: '$40/day geofenced within 15 miles',
      scaleRule: 'Double spend when appointment calendar reaches 70% fill rate with show-up rate > 80%.',
      optimizationNotes: [
        'Rotate creative every 10 days to avoid fatigue in small audiences.',
        'Sync booked appointments back to custom audience to exclude quickly.',
      ],
    },
    targetAudiences: [
      {
        label: 'Local Core',
        description: 'Age/gender + interest segments relevant to service.',
        tactics: ['Zip-code targeting', 'Interest layering (fitness + family + location)'],
      },
      {
        label: 'Community Builders',
        description: 'People who engage with local events or charity pages.',
        tactics: ['Engagement custom audiences', 'Local influencer collaborations'],
      },
      {
        label: 'Past Customers',
        description: 'CRM segments for reactivation and referrals.',
        tactics: ['Upload customer list monthly', 'Loyalty referral campaign with ad + email'],
      },
    ],
    timeline: [
      {
        phase: 'Week 1',
        duration: '7 days',
        focus: 'Awareness push + collect social proof feedback.',
        kpis: ['Reach > 8,000 locals', 'Traffic CTA clicks > 150'],
      },
      {
        phase: 'Week 2',
        duration: '7 days',
        focus: 'Appointment reminder ads + SMS follow-up.',
        kpis: ['Bookings per day > 6', 'Show-up rate > 75%'],
      },
      {
        phase: 'Ongoing',
        duration: '30 days',
        focus: 'Rotate offers (seasonal, partner offers) and track referrals.',
        kpis: ['Customer referral rate > 20%', 'Repeat visits per month +15%'],
      },
    ],
    kpiNorthStar: 'Cost per kept appointment versus lifetime value of a local customer.',
    resources: [
      'Community partnership outreach script',
      'Appointment reminder automation SOP',
      'Local testimonial request checklist',
    ],
  },
];
