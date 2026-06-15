export const isInAppBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  const rules = [
    'Instagram',
    'FBAN',
    'FBAV',
    'Line',
    'LinkedIn',
    'Twitter',
    'FBIOS',
  ];

  return rules.some(rule => ua.includes(rule));
};
