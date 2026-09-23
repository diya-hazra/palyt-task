'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toBase,
  isDishAvailable,
  getMenuWithAvailability,
  deductStockForOrder,
  canDeleteIngredient,
  deleteIngredient,
  validateIngredient,
} = require('./logic');

function freshStock() {
  return [
    { id: 'paneer', name: 'Paneer', quantity: 2, unit: 'kg', par: 1 },
    { id: 'cream', name: 'Cream', quantity: 0.5, unit: 'l', par: 1 },
    { id: 'cashews', name: 'Cashews', quantity: 0.55, unit: 'kg', par: 0.5 },
    { id: 'bay_leaves', name: 'Bay Leaves', quantity: 0.05, unit: 'kg', par: 0.02 },
  ];
}

function freshRecipes() {
  return [
    {
      id: 'paneer_butter_masala',
      name: 'Paneer Butter Masala',
      price: 320,
      ingredients: [
        { ingredientId: 'paneer', amount: 180, unit: 'g' },
        { ingredientId: 'cream', amount: 60, unit: 'ml' },
      ],
    },
    {
      id: 'kaju_curry',
      name: 'Kaju Curry',
      price: 300,
      ingredients: [{ ingredientId: 'cashews', amount: 60, unit: 'g' }],
    },
    {
      id: 'cashew_pulao',
      name: 'Cashew Pulao',
      price: 260,
      ingredients: [{ ingredientId: 'cashews', amount: 40, unit: 'g' }],
    },
  ];
}

test('toBase converts kg to g and l to ml, leaves g/ml alone', () => {
  assert.equal(toBase(1, 'kg'), 1000);
  assert.equal(toBase(180, 'g'), 180);
  assert.equal(toBase(0.5, 'l'), 500);
  assert.equal(toBase(60, 'ml'), 60);
});

test('a dish is unavailable if ANY ingredient is below par, even if others are fine', () => {
  const stock = freshStock();
  const [pbm] = freshRecipes();
  assert.equal(isDishAvailable(pbm, stock), false);
});

test('a dish is available when every ingredient it uses is at or above par', () => {
  const stock = freshStock();
  const [, kajuCurry] = freshRecipes();
  assert.equal(isDishAvailable(kajuCurry, stock), true);
});

test('deducting stock reduces quantity by exactly the recipe amount, unit-converted', () => {
  const stock = freshStock();
  const [, kajuCurry] = freshRecipes();
  const after = deductStockForOrder(kajuCurry, stock);
  const cashews = after.find((s) => s.id === 'cashews');
  assert.equal(cashews.quantity, 0.49);
  assert.equal(stock.find((s) => s.id === 'cashews').quantity, 0.55);
});

test('one order can push a shared ingredient below par and take multiple dishes off the menu', () => {
  const stock = freshStock();
  const recipes = freshRecipes();
  const [, kajuCurry, cashewPulao] = recipes;

  let menu = getMenuWithAvailability(recipes, stock);
  assert.equal(menu.find((d) => d.id === 'kaju_curry').available, true);
  assert.equal(menu.find((d) => d.id === 'cashew_pulao').available, true);

  const stockAfter = deductStockForOrder(kajuCurry, stock);
  menu = getMenuWithAvailability(recipes, stockAfter);

  assert.equal(menu.find((d) => d.id === 'kaju_curry').available, false);
  assert.equal(menu.find((d) => d.id === 'cashew_pulao').available, false);
});

test('ordering a dish that is not available throws and does not touch stock', () => {
  const stock = freshStock();
  const [pbm] = freshRecipes();
  assert.throws(() => deductStockForOrder(pbm, stock));
});

test('deleting an ingredient no recipe uses is allowed', () => {
  const { canDelete, affectedDishes } = canDeleteIngredient('bay_leaves', freshRecipes());
  assert.equal(canDelete, true);
  assert.deepEqual(affectedDishes, []);
});

test('deleting an ingredient recipes depend on is blocked by default', () => {
  const { canDelete, affectedDishes } = canDeleteIngredient('cashews', freshRecipes());
  assert.equal(canDelete, false);
  assert.deepEqual(affectedDishes.sort(), ['Cashew Pulao', 'Kaju Curry']);
});

test('deleteIngredient throws without force when the ingredient is in use', () => {
  const stock = freshStock();
  const recipes = freshRecipes();
  assert.throws(() => deleteIngredient('cashews', stock, recipes));
});

test('deleteIngredient with force removes the ingredient and marks its dishes discontinued', () => {
  const stock = freshStock();
  const recipes = freshRecipes();
  const result = deleteIngredient('cashews', stock, recipes, { force: true });

  assert.equal(result.stock.some((s) => s.id === 'cashews'), false);
  const kajuCurry = result.recipes.find((d) => d.id === 'kaju_curry');
  assert.equal(kajuCurry.discontinued, true);
  assert.equal(kajuCurry.ingredients.some((l) => l.ingredientId === 'cashews'), false);
});

test('validateIngredient rejects negative quantity and par', () => {
  const stock = freshStock();
  const errors = validateIngredient(
    { name: 'Flour', quantity: -1, par: -1, unit: 'kg' },
    stock
  );
  assert.ok(errors.length >= 2);
});

test('validateIngredient rejects duplicate names (case-insensitive)', () => {
  const stock = freshStock();
  const errors = validateIngredient(
    { name: 'PANEER', quantity: 1, par: 1, unit: 'kg' },
    stock
  );
  assert.ok(errors.some((e) => /already exists/.test(e)));
});

test('validateIngredient allows editing a row without tripping its own duplicate-name check', () => {
  const stock = freshStock();
  const errors = validateIngredient(
    { name: 'Paneer', quantity: 3, par: 1, unit: 'kg' },
    stock,
    { editingId: 'paneer' }
  );
  assert.deepEqual(errors, []);
});

test('validateIngredient rejects an unknown unit', () => {
  const stock = freshStock();
  const errors = validateIngredient(
    { name: 'Flour', quantity: 1, par: 1, unit: 'bag' },
    stock
  );
  assert.ok(errors.some((e) => /Unit must be one of/.test(e)));
});
