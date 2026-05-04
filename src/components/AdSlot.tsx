import { useEffect, useRef } from "react";

/**
 * AdSlot — paste your Monetag / ad-network HTML or <script> tags inside
 * the `dangerouslySetInnerHTML` block below. Any <script> tags will be
 * re-injected so they actually execute when this component mounts.
 *
 * Example (Monetag / Adsterra / etc.):
 *   <script src="//pl12345.profitabledisplay.com/abc/invoke.js"></script>
 *   <div id="123abc"></div>
 *
 * The ad will play automatically inside the player as a commercial break.
 */
const AD_HTML = `
  <!-- 👉 PASTE YOUR MONETAG / AD TAGS HERE 👈 -->
  <meta name="monetag" content="0d9f6fc3e0852977528084db4385c0ab">
  <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;text-align:center;padding:24px;font-family:system-ui;">
    <div>
      <div style="opacity:.6;font-size:12px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px;">Advertisement</div>
      <div style="font-size:18px;font-weight:600;">Your ad will appear here.</div>
      <div style="opacity:.6;font-size:12px;margin-top:8px;">Edit <code>src/components/AdSlot.tsx</code> to insert your Monetag tags.</div>
    </div>
  </div>
`;

export const AdSlot = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = AD_HTML;
    // Re-inject <script> tags so they execute
    host.querySelectorAll("script").forEach((old) => {
      const s = document.createElement("script");
      for (const attr of Array.from(old.attributes)) s.setAttribute(attr.name, attr.value);
      s.text = old.text;
      old.replaceWith(s);
    });
  }, []);

  return <div ref={ref} className="w-full h-full bg-black" />;
};

export default AdSlot;
