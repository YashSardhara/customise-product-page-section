// Custom Product section behaviour — standalone, no theme imports.
// Handles: variant selection -> price/media/availability, quantity stepper,
// thumbnail swap, and add-to-cart via Shopify AJAX API with loading + validation.
class CustomProduct extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('.cp__form');
    if (!this.form) return; // no product context (e.g. editor placeholder)

    this.idInput = this.querySelector('[data-cp-id]');
    this.priceEl = this.querySelector('[data-cp-price]');
    this.mediaEl = this.querySelector('[data-cp-media]');
    this.atc = this.querySelector('[data-cp-atc]');
    this.atcLabel = this.querySelector('[data-cp-atc-label]');
    this.errorEl = this.querySelector('[data-cp-error]');
    this.qtyInput = this.querySelector('[data-cp-qty]');
    this.optionFieldsets = [...this.querySelectorAll('[data-cp-option-position]')];

    try {
      this.variants = JSON.parse(this.querySelector('[data-cp-variants]').textContent);
    } catch {
      this.variants = [];
    }

    this.addToCartText = this.atcLabel ? this.atcLabel.textContent.trim() : 'Add to cart';

    // Variant + quantity handlers
    this.querySelectorAll('.cp__swatch-input').forEach((input) =>
      input.addEventListener('change', () => this.onVariantChange())
    );
    this.querySelectorAll('[data-cp-step]').forEach((btn) =>
      btn.addEventListener('click', () => this.stepQty(Number(btn.dataset.cpStep)))
    );
    this.querySelectorAll('[data-cp-thumb]').forEach((btn) =>
      btn.addEventListener('click', () => this.swapThumb(btn))
    );

    this.form.addEventListener('submit', (e) => this.onSubmit(e));

    // Single-variant products: id already set server-side, so it's ready to add.
    this.currentVariant = this.optionFieldsets.length === 0 ? this.variants[0] : null;
  }

  // Collect one selected value per option, in option-position order.
  getSelectedOptions() {
    const values = [];
    for (const fs of this.optionFieldsets) {
      const checked = fs.querySelector('.cp__swatch-input:checked');
      if (!checked) return null; // an option is unselected
      values.push(checked.value);
    }
    return values;
  }

  findVariant(selected) {
    return this.variants.find(
      (v) => v.options.length === selected.length && v.options.every((o, i) => o === selected[i])
    );
  }

  onVariantChange() {
    this.clearError();
    const selected = this.getSelectedOptions();

    if (!selected) {
      this.currentVariant = null;
      this.setButton('Select options', true);
      return;
    }

    const variant = this.findVariant(selected);
    this.currentVariant = variant || null;

    if (!variant) {
      this.setButton('Unavailable', true);
      return;
    }

    this.idInput.value = variant.id;
    this.updatePrice(variant);
    if (variant.media && this.mediaEl) this.mediaEl.src = variant.media;

    if (variant.available) {
      this.setButton(this.addToCartText, false);
    } else {
      this.setButton('Sold out', true);
    }
  }

  updatePrice(variant) {
    if (!this.priceEl) return;
    if (variant.compare_at) {
      this.priceEl.innerHTML =
        `<span class="cp__price-current">${variant.price}</span> <s class="cp__price-was">${variant.compare_at}</s>`;
    } else {
      this.priceEl.textContent = variant.price;
    }
  }

  setButton(label, disabled) {
    if (this.atcLabel) this.atcLabel.textContent = label;
    if (this.atc) this.atc.disabled = disabled;
  }

  stepQty(delta) {
    const next = Math.max(1, (parseInt(this.qtyInput.value, 10) || 1) + delta);
    this.qtyInput.value = next;
  }

  swapThumb(btn) {
    if (this.mediaEl && btn.dataset.cpThumbSrc) this.mediaEl.src = btn.dataset.cpThumbSrc;
    this.querySelectorAll('[data-cp-thumb]').forEach((b) => b.classList.toggle('is-active', b === btn));
  }

  clearError() {
    if (!this.errorEl) return;
    this.errorEl.hidden = true;
    this.errorEl.textContent = '';
  }

  showError(message) {
    if (!this.errorEl) return;
    this.errorEl.textContent = message;
    this.errorEl.hidden = false;
  }

  async onSubmit(event) {
    event.preventDefault();

    // Validation: a purchasable variant must be resolved.
    if (this.optionFieldsets.length && !this.getSelectedOptions()) {
      this.showError('Please select all options first.');
      return;
    }
    if (!this.idInput.value || !this.currentVariant || !this.currentVariant.available) {
      this.showError('Please select an available option.');
      return;
    }

    this.clearError();
    this.setLoading(true);

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          id: Number(this.idInput.value),
          quantity: Number(this.qtyInput.value) || 1,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        this.showError(data.description || data.message || 'Could not add to cart.');
        this.setLoading(false);
        return;
      }

      // Success: brief confirmation, notify theme, then reset.
      this.setLoading(false);
      this.setButton('Added ✓', true);
      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { source: 'custom-product' } }));
      setTimeout(() => this.setButton(this.addToCartText, false), 2000);
    } catch {
      this.showError('Network error. Please try again.');
      this.setLoading(false);
    }
  }

  setLoading(loading) {
    if (!this.atc) return;
    this.atc.setAttribute('aria-busy', loading ? 'true' : 'false');
    this.atc.disabled = loading;
    if (this.atcLabel) this.atcLabel.textContent = loading ? 'Adding…' : this.addToCartText;
  }
}

if (!customElements.get('custom-product')) {
  customElements.define('custom-product', CustomProduct);
}
