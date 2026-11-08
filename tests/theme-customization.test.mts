import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCustomization, customizationCss, exportedThemeCss } from '../src/themeCustomization.ts';

test('legacy theme widths and font stacks retain their pixel meaning', () => {
  const old = normalizeCustomization({contentWidth:720,fontFamily:'Georgia, "宋体", serif',codeFontFamily:'"JetBrains Mono", monospace'});
  assert.equal(old.contentWidthUnit,'px');
  assert.match(customizationCss(old),/--document-width:720px/);
  assert.match(customizationCss(old),/--document-font:Georgia, "宋体", serif/);
  assert.match(customizationCss(old),/--code-font:"JetBrains Mono", monospace/);
});
test('percentage widths export and roundtrip without losing the separate pixel value', () => {
  const value=normalizeCustomization({contentWidth:720,contentWidthUnit:'%',contentWidthPercent:75});
  assert.match(exportedThemeCss('/* original */',value),/--document-width:75%/);
  assert.deepEqual(normalizeCustomization(JSON.parse(JSON.stringify(value))),value);
  assert.match(customizationCss({...value,contentWidthUnit:'px'}),/--document-width:720px/);
});
test('invalid width units and nonfinite percentages cannot generate CSS', () => {
  assert.equal(normalizeCustomization({contentWidthUnit:'vw;display:none'}).contentWidthUnit,'px');
  for(const invalid of [null,'60',NaN,Infinity]) assert.equal(normalizeCustomization({contentWidthPercent:invalid}).contentWidthPercent,90);
  assert.equal(normalizeCustomization({contentWidthPercent:-1}).contentWidthPercent,20);
  assert.equal(normalizeCustomization({contentWidthPercent:200}).contentWidthPercent,100);
  assert.equal(normalizeCustomization({codeFontFamily:'url(https://example.invalid/font)'}).codeFontFamily,'');
});
