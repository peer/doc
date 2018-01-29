/**
 * little helper function for measuring Y offset of element on viewport
 * @param {*} el - DOM element to calculate Y offset
 * @returns {number} Offset
 */
export default function offsetY(el) {
  const rect = el.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return rect.top + scrollTop;
}
