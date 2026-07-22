import { describe, expect, it } from 'vitest'
import { parseProductLink } from '@/utils/product-ocr-api.js'

describe('parseProductLink', () => {
  it('cleans Mercado Livre product URLs', () => {
    const result = parseProductLink(
      'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-fiat-punto-2007-2008-2009-2010-2011-2012-_JM?searchVariation=176238608527#polycard_client=search-desktop&reco_item_pos=2',
    )

    expect(result).toMatchObject({
      marketplace: 'Mercado Livre',
      slug: 'lanterna traseira fiat punto 2007 2008 2009 2010 2011 2012',
      itemId: 'MLB-3091989768',
      canonicalUrl: 'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-fiat-punto-2007-2008-2009-2010-2011-2012-_JM',
      hasVariation: true,
    })
    expect(result.removedParams).toEqual(expect.arrayContaining(['searchVariation', '#hash']))
  })

  it('removes long advertising parameters without contaminating the Mercado Livre id', () => {
    const result = parseProductLink(
      'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-fiat-punto-_JM?matt_tool=18956390&matt_word=&matt_source=google&matt_campaign_id=22603531580&matt_ad_group_id=181541648567&matt_match_type=&matt_network=g&matt_device=c&matt_creative=758614190817&matt_keyword=&matt_ad_position=&matt_ad_type=pla&matt_merchant_id=735125183&matt_product_id=MLB3091989768&matt_product_partition_id=2423664641244&matt_target_id=pla-2423664641244&cq_src=google_ads&cq_cmp=22603531580&cq_net=g&cq_plt=gp&gclid=tracking-token#advertising',
    )

    expect(result).toMatchObject({
      itemId: 'MLB-3091989768',
      canonicalUrl: 'https://produto.mercadolivre.com.br/MLB-3091989768-lanterna-traseira-fiat-punto-_JM',
    })
    expect(result.canonicalUrl).not.toContain('?')
    expect(result.removedParams).toEqual(expect.arrayContaining(['matt_tool', 'gclid', '#hash']))
  })

  it('extracts Shopee product ids from product URLs', () => {
    const result = parseProductLink(
      'https://shopee.com.br/Lanterna-Traseira-Fiat-Punto-2007-2008-2009-2010-2011-2012-i.106967789.2319888491',
    )

    expect(result).toMatchObject({
      marketplace: 'Shopee',
      slug: 'Lanterna Traseira Fiat Punto 2007 2008 2009 2010 2011 2012',
      itemId: '106967789:2319888491',
      canonicalUrl: 'https://shopee.com.br/Lanterna-Traseira-Fiat-Punto-2007-2008-2009-2010-2011-2012-i.106967789.2319888491',
    })
  })

  it('preserves the exact Mercado Livre item id hidden in pdp_filters', () => {
    const result = parseProductLink(
      'https://www.mercadolivre.com.br/lanterna-traseira-direita-punto-2007-2008-2009-2010-11-2012/up/MLBU3323247036?pdp_filters=item_id%3AMLB5518871186&from=gshop&matt_source=google',
    )

    expect(result).toMatchObject({
      marketplace: 'Mercado Livre',
      slug: 'lanterna traseira direita punto 2007 2008 2009 2010 11 2012',
      itemId: 'MLB-5518871186',
      catalogItemId: 'MLBU3323247036',
      canonicalUrl: 'https://www.mercadolivre.com.br/lanterna-traseira-direita-punto-2007-2008-2009-2010-11-2012/up/MLBU3323247036',
    })
  })

  it('keeps Shopee product references without using the numeric id as a title', () => {
    const result = parseProductLink(
      'https://shopee.com.br/product/1629552564/58254957903?utm_source=google&gclid=tracking',
    )

    expect(result).toMatchObject({
      marketplace: 'Shopee',
      slug: '',
      itemId: '1629552564:58254957903',
      canonicalUrl: 'https://shopee.com.br/product/1629552564/58254957903',
    })
  })
})
