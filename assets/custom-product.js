// Custom Product coordination — standalone, no theme imports.
// <cp-variant> resolves the selected variant and drives the sibling theme
// buy-buttons form: sets input[name="id"], updates the cp-price block, swaps
// section media, and toggles the theme add-to-cart button (which keeps the
// theme's fly-to-cart animation + cart drawer). Also wires image thumbnails.

class CpVariant extends HTMLElement {
  connectedCallback() {
    this.scope = this.closest('.shopify-section') || document;
    this.fieldsets = [...this.querySelectorAll('[data-cp-option-position]')].sort(
      (a, b) => Number(a.dataset.cpOptionPosition) - Number(b.dataset.cpOptionPosition)
    );

    try {
      this.variants = JSON.parse(this.querySelector('[data-cp-variants]').textContent);
    } catch {
      this.variants = [];
    }

    this.querySelectorAll('.cp-variant__input').forEach((input) =>
      input.addEventListener('change', () => this.update())
    );

    this.update(); // no pre-selection -> disables add-to-cart until a valid pick
  }

  get idInput() {
    return this.scope.querySelector('form[data-type="add-to-cart-form"] input[name="id"]');
  }
  get priceEl() {
    return this.scope.querySelector('[data-cp-price]');
  }
  get mediaEl() {
    return this.scope.querySelector('[data-cp-media]');
  }
  get atcComponent() {
    return this.scope.querySelector('add-to-cart-component');
  }
  get atcButton() {
    const c = this.atcComponent;
    return c ? c.querySelector('button, [ref="addToCartButton"]') : null;
  }

  getSelected() {
    const values = [];
    for (const fs of this.fieldsets) {
      const checked = fs.querySelector('.cp-variant__input:checked');
      if (!checked) return null;
      values.push(checked.value);
    }
    return values;
  }

  findVariant(selected) {
    return this.variants.find(
      (v) => v.options.length === selected.length && v.options.every((o, i) => o === selected[i])
    );
  }

  update() {
    this.reflectSelectedLabels();
    const selected = this.getSelected();

    if (!selected) return this.setAtc(false); // some option still unselected

    const variant = this.findVariant(selected);
    if (!variant) {
      if (this.idInput) this.idInput.value = '';
      return this.setAtc(false); // combination not offered
    }

    if (this.idInput) this.idInput.value = variant.id;
    this.updatePrice(variant);
    if (variant.media && this.mediaEl) this.mediaEl.src = variant.media;
    if (variant.media && this.atcComponent) {
      this.atcComponent.setAttribute('data-product-variant-media', variant.media + '&width=100');
    }
    this.setAtc(variant.available);
  }

  reflectSelectedLabels() {
    if (this.dataset.showSelected !== 'true') return;
    for (const fs of this.fieldsets) {
      const target = fs.querySelector('[data-cp-selected]');
      if (!target) continue;
      const checked = fs.querySelector('.cp-variant__input:checked');
      target.textContent = checked ? `: ${checked.value}` : '';
    }
  }

  updatePrice(variant) {
    const el = this.priceEl;
    if (!el) return;
    if (variant.compare_at) {
      el.innerHTML =
        `<span class="cp-price__current cp-price__current--sale">${variant.price}</span> <s class="cp-price__was">${variant.compare_at}</s>`;
    } else {
      el.innerHTML = `<span class="cp-price__current">${variant.price}</span>`;
    }
  }

  // Enable/disable the theme add-to-cart button (prefer its component API).
  setAtc(enabled) {
    const c = this.atcComponent;
    if (c && typeof c.enable === 'function' && typeof c.disable === 'function') {
      enabled ? c.enable() : c.disable();
    } else if (this.atcButton) {
      this.atcButton.disabled = !enabled;
    }
  }
}

if (!customElements.get('cp-variant')) {
  customElements.define('cp-variant', CpVariant);
}

// Image thumbnails -> swap the main media image (delegated, works for all sections).
document.addEventListener('click', (event) => {
  const thumb = event.target.closest('[data-cp-thumb]');
  if (!thumb) return;
  const scope = thumb.closest('.shopify-section') || document;
  const main = scope.querySelector('[data-cp-media]');
  if (main && thumb.dataset.cpThumbSrc) main.src = thumb.dataset.cpThumbSrc;
  scope.querySelectorAll('[data-cp-thumb]').forEach((b) => b.classList.toggle('is-active', b === thumb));
});
