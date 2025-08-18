import { placeSignature, validatePlacementInput } from '../signature-placement'

describe('Signature Placement - Single Source of Truth', () => {
  // Test A: Your 2nd log set (270° rotation)
  describe('Test A: 270° rotation with fixed stamp', () => {
    it('should place signature correctly with fixed 150x75 stamp', () => {
      const result = placeSignature(
        {
          pageNumber: 1,
          original: { W: 612, H: 792 },
          rotation: 270
        },
        {
          rx: 0.7234848484848485,
          ry: 0.7418300653594772,
          rw: 0.24509803921568626,
          rh: 0.0946969696969697
        },
        {
          strategy: "fixed",
          fixedSize: { w: 150, h: 75 }
        }
      )

      // Verify overlay calculations
      expect(result.overlay.overlay.Wv).toBe(792)
      expect(result.overlay.overlay.Hv).toBe(612)
      expect(result.overlay.x_v).toBeCloseTo(573, 0) // 0.7234848 * 792 ≈ 573
      expect(result.overlay.y_v).toBeCloseTo(454, 0) // 0.7418301 * 612 ≈ 454

      // Verify pdf-lib coordinates (270°: x = y_v, y = x_v)
      expect(result.merge.x).toBeCloseTo(454, 0)
      expect(result.merge.y).toBeCloseTo(573, 0)
      expect(result.merge.w).toBe(150)
      expect(result.merge.h).toBe(75)

      // Verify log format
      expect(result.log).toContain('MERGE v1 | page=1 rot=270')
      expect(result.log).toContain('W=612 H=792')
      expect(result.log).toContain('Wv=792 Hv=612')
      expect(result.log).toContain('stamp(w,h)=150x75')
      expect(result.log).toContain('-> pdf(x,y,w,h)=(454.000,573.000,150.000,75.000)')
    })

    it('should place signature correctly with relative stamp', () => {
      const result = placeSignature(
        {
          pageNumber: 1,
          original: { W: 612, H: 792 },
          rotation: 270
        },
        {
          rx: 0.7234848484848485,
          ry: 0.7418300653594772,
          rw: 0.24509803921568626,
          rh: 0.0946969696969697
        },
        {
          strategy: "relative"
        }
      )

      // Expected relative stamp size
      const expectedW = 0.24509803921568626 * 792 // ≈ 194.1176471
      const expectedH = 0.0946969696969697 * 612   // ≈ 57.95454545

      expect(result.merge.x).toBeCloseTo(454, 0)
      expect(result.merge.y).toBeCloseTo(573, 0)
      expect(result.merge.w).toBeCloseTo(expectedW, 3)
      expect(result.merge.h).toBeCloseTo(expectedH, 3)
    })
  })

  // Test B: Your 1st log set variant (270° rotation)
  describe('Test B: 270° rotation variant', () => {
    it('should handle slight coordinate variations', () => {
      const result = placeSignature(
        {
          pageNumber: 1,
          original: { W: 612, H: 792 },
          rotation: 270
        },
        {
          rx: 0.7386363636,
          ry: 0.74346405229,
          rw: 0.24509803921568626,
          rh: 0.0946969696969697
        },
        {
          strategy: "fixed",
          fixedSize: { w: 150, h: 75 }
        }
      )

      const expectedXv = 0.7386363636 * 792 // ≈ 585
      const expectedYv = 0.74346405229 * 612 // ≈ 455

      expect(result.overlay.x_v).toBeCloseTo(585, 0)
      expect(result.overlay.y_v).toBeCloseTo(455, 0)
      expect(result.merge.x).toBeCloseTo(455, 0)
      expect(result.merge.y).toBeCloseTo(585, 0)
    })
  })

  // Test C: 90° rotation
  describe('Test C: 90° rotation', () => {
    it('should apply correct 90° transformation', () => {
      const result = placeSignature(
        {
          pageNumber: 1,
          original: { W: 612, H: 792 },
          rotation: 90
        },
        {
          rx: 0.5,  // Center
          ry: 0.5,
          rw: 0.2,
          rh: 0.1
        },
        {
          strategy: "fixed",
          fixedSize: { w: 150, h: 75 }
        }
      )

      // Overlay dimensions for 90°: Wv=H=792, Hv=W=612
      expect(result.overlay.overlay.Wv).toBe(792)
      expect(result.overlay.overlay.Hv).toBe(612)

      const x_v = 0.5 * 792 // 396
      const y_v = 0.5 * 612 // 306

      // Center-rotation mode: compute center coordinates directly
      // Overlay center: c_v_x = 396 + 75 = 471, c_v_y = 306 + 37.5 = 343.5
      // PDF center: cx = W - (y_v + h/2) = 612 - (306 + 37.5) = 268.5
      //            cy = H - (x_v + w/2) = 792 - (396 + 75) = 321
      // Bottom-left: x = cx - w/2 = 268.5 - 75 = 193.5
      //             y = cy - h/2 = 321 - 37.5 = 283.5
      const expectedCx = 612 - (306 + 37.5) // 268.5
      const expectedCy = 792 - (396 + 75)   // 321
      const expectedX = expectedCx - 75     // 193.5
      const expectedY = expectedCy - 37.5   // 283.5

      expect(result.merge.cx).toBeCloseTo(expectedCx, 1)
      expect(result.merge.cy).toBeCloseTo(expectedCy, 1)
      expect(result.merge.x).toBeCloseTo(expectedX, 1)
      expect(result.merge.y).toBeCloseTo(expectedY, 1)
    })
  })

  // Test D: 0° and 180° rotations
  describe('Test D: 0° and 180° rotations', () => {
    it('should handle 0° rotation (no rotation)', () => {
      const result = placeSignature(
        {
          pageNumber: 1,
          original: { W: 612, H: 792 },
          rotation: 0
        },
        {
          rx: 0.25,  // Left quarter
          ry: 0.25,  // Top quarter
          rw: 0.2,
          rh: 0.1
        },
        {
          strategy: "fixed",
          fixedSize: { w: 150, h: 75 }
        }
      )

      // For 0°: Wv = W, Hv = H
      expect(result.overlay.overlay.Wv).toBe(612)
      expect(result.overlay.overlay.Hv).toBe(792)

      const x_v = 0.25 * 612 // 153
      const y_v = 0.25 * 792 // 198

      // 0° formula: x = x_v, y = H - (y_v + h)
      const expectedX = x_v // 153
      const expectedY = 792 - (y_v + 75) // 792 - 273 = 519

      expect(result.merge.x).toBeCloseTo(expectedX, 0)
      expect(result.merge.y).toBeCloseTo(expectedY, 0)
    })

    it('should handle 180° rotation', () => {
      const result = placeSignature(
        {
          pageNumber: 1,
          original: { W: 612, H: 792 },
          rotation: 180
        },
        {
          rx: 0.75,  // Right side
          ry: 0.75,  // Bottom side
          rw: 0.2,
          rh: 0.1
        },
        {
          strategy: "fixed",
          fixedSize: { w: 150, h: 75 }
        }
      )

      const x_v = 0.75 * 612 // 459
      const y_v = 0.75 * 792 // 594

      // 180° formula: x = W - x_v - w, y = y_v
      const expectedX = 612 - 459 - 150 // 3
      const expectedY = y_v // 594

      expect(result.merge.x).toBeCloseTo(expectedX, 0)
      expect(result.merge.y).toBeCloseTo(expectedY, 0)
    })
  })

  // Validation tests
  describe('Input validation', () => {
    it('should validate page info', () => {
      expect(validatePlacementInput(
        { pageNumber: 0, original: { W: 612, H: 792 }, rotation: 0 },
        { rx: 0.5, ry: 0.5, rw: 0.2, rh: 0.1 },
        { strategy: "fixed", fixedSize: { w: 150, h: 75 } }
      )).toEqual({ valid: false, error: "Page number must be >= 1" })

      expect(validatePlacementInput(
        { pageNumber: 1, original: { W: -612, H: 792 }, rotation: 0 },
        { rx: 0.5, ry: 0.5, rw: 0.2, rh: 0.1 },
        { strategy: "fixed", fixedSize: { w: 150, h: 75 } }
      )).toEqual({ valid: false, error: "Page dimensions must be positive" })

      expect(validatePlacementInput(
        { pageNumber: 1, original: { W: 612, H: 792 }, rotation: 45 as any },
        { rx: 0.5, ry: 0.5, rw: 0.2, rh: 0.1 },
        { strategy: "fixed", fixedSize: { w: 150, h: 75 } }
      )).toEqual({ valid: false, error: "Rotation must be 0, 90, 180, or 270" })
    })

    it('should validate relative box', () => {
      expect(validatePlacementInput(
        { pageNumber: 1, original: { W: 612, H: 792 }, rotation: 0 },
        { rx: -0.1, ry: 0.5, rw: 0.2, rh: 0.1 },
        { strategy: "fixed", fixedSize: { w: 150, h: 75 } }
      )).toEqual({ valid: false, error: "Relative coordinates must be in [0..1]" })

      expect(validatePlacementInput(
        { pageNumber: 1, original: { W: 612, H: 792 }, rotation: 0 },
        { rx: 0.9, ry: 0.5, rw: 0.2, rh: 0.1 },
        { strategy: "fixed", fixedSize: { w: 150, h: 75 } }
      )).toEqual({ valid: false, error: "Relative box extends beyond page bounds" })
    })

    it('should validate stamp config', () => {
      expect(validatePlacementInput(
        { pageNumber: 1, original: { W: 612, H: 792 }, rotation: 0 },
        { rx: 0.5, ry: 0.5, rw: 0.2, rh: 0.1 },
        { strategy: "fixed" }
      )).toEqual({ valid: false, error: "Fixed stamp size required when strategy is 'fixed'" })

      expect(validatePlacementInput(
        { pageNumber: 1, original: { W: 612, H: 792 }, rotation: 0 },
        { rx: 0.5, ry: 0.5, rw: 0.2, rh: 0.1 },
        { strategy: "fixed", fixedSize: { w: -150, h: 75 } }
      )).toEqual({ valid: false, error: "Fixed stamp size must be positive" })
    })

    it('should pass valid input', () => {
      expect(validatePlacementInput(
        { pageNumber: 1, original: { W: 612, H: 792 }, rotation: 270 },
        { rx: 0.5, ry: 0.5, rw: 0.2, rh: 0.1 },
        { strategy: "fixed", fixedSize: { w: 150, h: 75 } }
      )).toEqual({ valid: true })

      expect(validatePlacementInput(
        { pageNumber: 1, original: { W: 612, H: 792 }, rotation: 90 },
        { rx: 0.5, ry: 0.5, rw: 0.2, rh: 0.1 },
        { strategy: "relative" }
      )).toEqual({ valid: true })
    })
  })

  // Precision tests
  describe('Precision handling', () => {
    it('should handle float quirks like 791.999978', () => {
      const result = placeSignature(
        {
          pageNumber: 1,
          original: { W: 612, H: 791.999978 }, // Quirky float
          rotation: 0
        },
        {
          rx: 0.5,
          ry: 0.5,
          rw: 0.2,
          rh: 0.1
        },
        {
          strategy: "fixed",
          fixedSize: { w: 150, h: 75 }
        }
      )

      // Should work with the quirky height
      expect(result.overlay.overlay.Hv).toBe(791.999978)
      const y_v = 0.5 * 791.999978
      const expectedY = 791.999978 - (y_v + 75)
      expect(result.merge.y).toBeCloseTo(expectedY, 3)
    })

    it('should maintain precision in calculations', () => {
      const result = placeSignature(
        {
          pageNumber: 1,
          original: { W: 612, H: 792 },
          rotation: 270
        },
        {
          rx: 0.7234848484848485,
          ry: 0.7418300653594772,
          rw: 0.24509803921568626,
          rh: 0.0946969696969697
        },
        {
          strategy: "relative"
        }
      )

      // Verify precise calculations
      const expectedXv = 0.7234848484848485 * 792
      const expectedYv = 0.7418300653594772 * 612
      const expectedW = 0.24509803921568626 * 792
      const expectedH = 0.0946969696969697 * 612

      expect(result.overlay.x_v).toBeCloseTo(expectedXv, 10)
      expect(result.overlay.y_v).toBeCloseTo(expectedYv, 10)
      expect(result.merge.w).toBeCloseTo(expectedW, 10)
      expect(result.merge.h).toBeCloseTo(expectedH, 10)
    })
  })
})
