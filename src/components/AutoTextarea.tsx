import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** A textarea that grows with its content. */
export function AutoTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string },
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    // Refit when the width changes (rotation, layout); ignore our own height edits.
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [props.value]);

  return <textarea ref={ref} rows={1} {...props} />;
}
