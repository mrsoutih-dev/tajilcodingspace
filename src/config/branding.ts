export interface BrandingConfig {
  productName: string;
  shortName: string;
  company: string;
  companyUrl: string;
  platformSubdomain: string;
  tagline: string;
  description: string;
  accent: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    secondary: string;
  };
}

export const branding: BrandingConfig = {
  productName: 'ZohoDigital AI Studio',
  shortName: 'AI Studio',
  company: 'ZohoDigital',
  companyUrl: 'https://zohodigital.com',
  platformSubdomain: 'https://coding.zohodigital.com',
  tagline: 'Build, deploy, and orchestrate AI-powered software from your browser.',
  description:
    'An integrated, self-hosted AI software factory for creating, developing, testing, and deploying applications directly from your browser.',
  accent: {
    primary: '#0ea5a4',
    primaryHover: '#0d948f',
    primaryActive: '#0f766e',
    secondary: '#38bdf8',
  },
};

export const omnirouteDefaults = {
  defaultBaseUrl: 'https://omniroute.tajil.com/v1',
  defaultApiKey: 'sk-35aba6ba1ce0cb11-ccc9d4-eecf3abc',
  defaultModel: 'Free Combo',
  chatPath: '/v1/chat/completions',
  modelsPath: '/v1/models',
};
