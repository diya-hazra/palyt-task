'use strict';

const BASE_UNIT_FACTOR = {
  kg: 1000,
  g: 1,
  l: 1000,
  ml: 1,
  piece: 1,
};

function toBase(amount, unit) {
  const factor = BASE_UNIT_FACTOR[unit];
  if (factor === undefined) {
    throw new Error(`Unknown unit: ${unit}`);
  }
  return amount * factor;
}

function fromBase(baseAmount, unit) {
  const factor = BASE_UNIT_FACTOR[unit];
  if (factor === undefined) {
    throw new Error(`Unknown unit: ${unit}`);
  }
  return baseAmount / factor;
}

function findIngredient(stock, ingredientId) {
  const item = stock.find((s) => s.id === ingredientId);
  if (!item) {
    throw new Error(`Unknown ingredient: ${ingredientId}`);
  }
  return item;
}

function isDishAvailable(dish, stock) {
  return dish.ingredients.every((line) => {
    const stockItem = findIngredient(stock, line.ingredientId);
    const qtyBase = toBase(stockItem.quantity, stockItem.unit);
    const parBase = toBase(stockItem.par, stockItem.unit);
    return qtyBase >= parBase;
  });
}

function getMenuWithAvailability(recipes, stock) {
  return recipes.map((dish) => ({
    ...dish,
    available: isDishAvailable(dish, stock),
  }));
}

function deductStockForOrder(dish, stock) {
  if (!isDishAvailable(dish, stock)) {
    throw new Error(`${dish.name} is not available and cannot be ordered.`);
  }

  return stock.map((stockItem) => {
    const line = dish.ingredients.find((l) => l.ingredientId === stockItem.id);
    if (!line) return stockItem;

    const usedBase = toBase(line.amount, line.unit);
    const currentBase = toBase(stockItem.quantity, stockItem.unit);
    const newBase = currentBase - usedBase;

    return {
      ...stockItem,
      quantity: fromBase(newBase, stockItem.unit),
    };
  });
}

function findDishesUsingIngredient(ingredientId, recipes) {
  return recipes.filter((dish) =>
    dish.ingredients.some((line) => line.ingredientId === ingredientId)
  );
}

function canDeleteIngredient(ingredientId, recipes) {
  const affected = findDishesUsingIngredient(ingredientId, recipes);
  return {
    canDelete: affected.length === 0,
    affectedDishes: affected.map((d) => d.name),
  };
}

function deleteIngredient(ingredientId, stock, recipes, { force = false } = {}) {
  const { canDelete, affectedDishes } = canDeleteIngredient(ingredientId, recipes);

  if (!canDelete && !force) {
    throw new Error(
      `Cannot delete: used by ${affectedDishes.join(', ')}. Pass force to delete anyway.`
    );
  }

  const newStock = stock.filter((s) => s.id !== ingredientId);
  const newRecipes = recipes.map((dish) => {
    if (!dish.ingredients.some((l) => l.ingredientId === ingredientId)) return dish;
    return {
      ...dish,
      ingredients: dish.ingredients.filter((l) => l.ingredientId !== ingredientId),
      discontinued: true,
    };
  });

  return { stock: newStock, recipes: newRecipes };
}


function validateIngredient(input, stock, { editingId = null } = {}) {
  const errors = [];
  const name = (input.name || '').trim();

  if (!name) errors.push('Name is required.');

  const duplicateName = stock.some(
    (s) => s.id !== editingId && s.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicateName) errors.push('An ingredient with this name already exists.');

  if (typeof input.quantity !== 'number' || Number.isNaN(input.quantity)) {
    errors.push('Quantity must be a number.');
  } else if (input.quantity < 0) {
    errors.push('Quantity cannot be negative.');
  }

  if (typeof input.par !== 'number' || Number.isNaN(input.par)) {
    errors.push('Par level must be a number.');
  } else if (input.par < 0) {
    errors.push('Par level cannot be negative.');
  }

  if (!BASE_UNIT_FACTOR[input.unit]) {
    errors.push(`Unit must be one of: ${Object.keys(BASE_UNIT_FACTOR).join(', ')}.`);
  }

  return errors;
}

const api = {
  BASE_UNIT_FACTOR,
  toBase,
  fromBase,
  findIngredient,
  isDishAvailable,
  getMenuWithAvailability,
  deductStockForOrder,
  findDishesUsingIngredient,
  canDeleteIngredient,
  deleteIngredient,
  validateIngredient,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  window.PalytLogic = api;
}
