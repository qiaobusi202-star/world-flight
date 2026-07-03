// 全局配置：Cesium ion 令牌与常量
const DEFAULT_ION_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ZDZjYmViMi04Y2FkLTQxYjYtYTRiYi01M2VkZmI3MmNiMWQiLCJpZCI6NDUyMDQxLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODMwNjYwMzR9.Yfl6k_epliC-fPrpZa3shQp4Mg1bHYyyt3N30TN2wgs';

export function getIonToken() {
  return localStorage.getItem('wf_ion_token') || DEFAULT_ION_TOKEN;
}

export function setIonToken(token) {
  if (token && token.trim()) localStorage.setItem('wf_ion_token', token.trim());
  else localStorage.removeItem('wf_ion_token');
}

// Google Photorealistic 3D Tiles 在 Cesium ion Asset Depot 中的资产 ID
export const GOOGLE_TILES_ASSET_ID = 2275207;

export const QUALITY_PRESETS = {
  low:    { sse: 32, resolutionScale: 0.75, msaa: 1, clouds: false, label: '低' },
  medium: { sse: 16, resolutionScale: 1.0,  msaa: 1, clouds: true,  label: '中' },
  high:   { sse: 8,  resolutionScale: 1.0,  msaa: 4, clouds: true,  label: '高' },
};
