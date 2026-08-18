# Warmth & Efficiency System

## Brand & Style

This design system is built for the "Family Homework" context, prioritizing the needs of busy parents who require immediate clarity and a supportive atmosphere. The personality is **warm, reliable, and highly efficient**.

The aesthetic blends **Modern Minimalist** structures with **Soft Tactile** elements. By using a cream-based palette and generous roundedness, the UI avoids the coldness of typical productivity apps, instead feeling like a digital extension of a well-organized home. High density is maintained through tight internal padding and structured lists, ensuring parents can see multiple children's tasks at a single glance without feeling overwhelmed.

## Layout & Spacing

The layout is **Mobile-First** with a focus on one-handed "thumb-zone" ergonomics. 
- **Primary Actions:** Main CTAs (e.g., "Add Task", "Save") must be full-width and anchored to the bottom of the screen.
- **Grid:** Use a simple fluid column system with 16px (1rem) outer margins.
- **Density:** Internal card spacing is reduced to 12px (0.75rem) to maximize the amount of information visible without scrolling.
- **Interaction:** Every interactive element must adhere to the 48px minimum height/width rule to accommodate rapid tapping.

## Elevation & Depth

Depth is achieved through **Tonal Layers** and **Soft Ambient Shadows**.
- **Level 0 (Background):** Cream (#FFF8F0).
- **Level 1 (Cards):** White (#FFFFFF) with a very soft, 10% opacity shadow (Blur 8px, Y 2px) to lift it slightly from the cream base.
- **Level 2 (Active/Floating):** Use a slightly more pronounced shadow for floating action buttons or active states.
- **Outlines:** Use 1px borders in a darker cream or the child's accent color rather than heavy shadows to keep the UI clean and "high density."

## Components

### Buttons
- **Primary:** Full-width, 48px+ height, centered at the bottom of the screen. Use the Child's Accent color or the Primary Blue.
- **Secondary:** Outlined with 2px stroke, transparent background.

### Task Cards
- **Structure:** 16px radius, white background. Use a vertical 4px "color bar" on the left edge to indicate which child the task belongs to.
- **Status Indicator:** Small colored chips in the top right corner using the Status palette (Green/Amber/Red).

### Inputs & Forms
- **Fields:** 48px height, white background with a subtle border. Labels should be small and bolded above the field.
- **Checkboxes:** Large (24px x 24px) to ensure easy completion of tasks.

### Progress Chips
- Small, rounded pills used in list views to show "2/4 Tasks" or "Hôm nay" (Today).

### Lists
- High-density spacing with 8px between list items. Use dividers only when cards aren't appropriate.
