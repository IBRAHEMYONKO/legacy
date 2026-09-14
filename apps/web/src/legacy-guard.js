const SYNC_TIMEOUT_MS = 10000;

function isMeRequest(input) {
  const value = typeof input === 'string' ? input : input?.url || '';
  return String(value).includes('/api/me');
}

function showAuthError(message) {
  if (!message || document.getElementById('legacy-auth-error')) return;
  const box = document.createElement('div');
  box.id = 'legacy-auth-error';
  box.dir = 'rtl';
  box.style.cssText = 'position:fixed;inset:20px auto auto 20px;z-index:99999;max-width:420px;padding:18px 20px;border:1px solid rgba(255,100,100,.35);border-radius:16px;background:#10151b;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.45);font-family:system-ui,sans-serif;line-height:1.7';
  box.innerHTML = `<b style="display:block;margin-bottom:6px">تعذر تسجيل الدخول</b><span>${String(message).replace(/[&<>\"]/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;' }[s]))}</span><button id="legacy-auth-error-close" style="display:block;margin-top:12px;padding:8px 14px;border:0;border-radius:10px;cursor:pointer">حسناً</button>`;
  document.body.appendChild(box);
  document.getElementById('legacy-auth-error-close')?.addEventListener('click', () => box.remove());
}

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  if (!isMeRequest(input)) return nativeFetch(input, init);

  const controller = new AbortController();
  const externalSignal = init.signal;
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await nativeFetch(input, { ...init, signal: controller.signal });
    if (response.status === 401) {
      localStorage.removeItem('legacy_token');
      window.dispatchEvent(new Event('legacy:logout'));
    }
    return response;
  } catch (error) {
    localStorage.removeItem('legacy_token');
    window.dispatchEvent(new Event('legacy:logout'));
    showAuthError(error?.name === 'AbortError' ? 'انتهت مهلة مزامنة الحساب. تأكد أن LEGACY API يعمل على المنفذ 4000 ثم سجّل الدخول مرة أخرى.' : 'تعذر الاتصال بخدمة LEGACY. تأكد أن جميع خدمات المشروع تعمل ثم حاول مرة أخرى.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const params = new URLSearchParams(location.search);
const authError = params.get('auth_error');
if (authError) {
  history.replaceState({}, '', location.pathname);
  window.addEventListener('DOMContentLoaded', () => showAuthError(authError), { once: true });
}
