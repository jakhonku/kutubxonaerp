// Server komponent — HTML ichiga inline skript qo'yadi.
//
// Chrome/Edge `beforeinstallprompt` hodisasini sahifa yuklanishi bilanoq,
// React hidratsiyasidan oldin yuboradi. Agar uni faqat useEffect ichida
// kutsak — hodisa allaqachon o'tib ketgan bo'ladi va "O'rnatish" tugmasi
// hech qachon ishlamaydi. Shu sabab uni eng erta nuqtada ushlab qo'yamiz.
const CAPTURE_SCRIPT = `(function(){
  if (window.__pwaCaptureReady) return;
  window.__pwaCaptureReady = true;
  window.__pwaPrompt = null;
  window.__pwaInstalled = false;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__pwaPrompt = e;
    window.dispatchEvent(new Event('pwa:available'));
  });
  window.addEventListener('appinstalled', function () {
    window.__pwaPrompt = null;
    window.__pwaInstalled = true;
    window.dispatchEvent(new Event('pwa:installed'));
  });
})();`;

export default function PwaInstallCapture() {
  return <script dangerouslySetInnerHTML={{ __html: CAPTURE_SCRIPT }} />;
}
