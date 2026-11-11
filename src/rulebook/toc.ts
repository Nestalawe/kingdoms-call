import { theElementWithTheId } from '../ui/shared/the-pages-element-with-the-id.ts';

(function () {
  const toc = theElementWithTheId('toc', HTMLElement),
    btn = document.getElementById('tocToggle');
  if (btn) {
    btn.addEventListener('click', function () {
      const open = toc.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  // On mobile, collapse the contents after tapping a link.
  toc.addEventListener('click', function (e) {
    if (theTagOfWhatWasClicked(e) === 'A' && window.matchMedia('(max-width:860px)').matches) {
      toc.classList.remove('open');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    }
  });
})();

/** The tag of the element a click landed on (`e.target.tagName`): a click is always on an element; any other target has
 *  no tag, and none throws the TypeError reading its tag threw. */
function theTagOfWhatWasClicked(e: Event): unknown {
  const target = e.target;
  if (target === null) throw new TypeError("a click's target is null");
  return target instanceof Element ? target.tagName : undefined;
}
