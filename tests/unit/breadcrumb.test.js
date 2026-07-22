import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Breadcrumb from '@/components/layout/Breadcrumb.vue'

describe('Release 8.3 breadcrumb', () => {
  it('renders route metadata as a readable path', () => {
    const wrapper = mount(Breadcrumb, {
      props: { items: ['Inteligencia', 'Wishlist', 'Produto'] },
    })

    expect(wrapper.text()).toContain('Inteligencia')
    expect(wrapper.text()).toContain('Wishlist')
    expect(wrapper.text()).toContain('Produto')
    expect(wrapper.find('[aria-current="page"]').text()).toBe('Produto')
  })
})
