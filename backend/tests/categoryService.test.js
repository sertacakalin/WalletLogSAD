const service = require('../services/categoryService');
const { ValidationError, NotFoundError } = require('../errors');

jest.mock('../models/categoryModel', () => ({
  getAll:  jest.fn(),
  getById: jest.fn(),
  create:  jest.fn(),
  update:  jest.fn(),
  remove:  jest.fn(),
}));

const model = require('../models/categoryModel');

const USER_ID = 1;

describe('categoryService — list / get', () => {
  afterEach(() => jest.clearAllMocks());

  test('list passes user_id to model', async () => {
    const rows = [{ id: 1, name: 'Food' }, { id: 2, name: 'Travel' }];
    model.getAll.mockResolvedValue(rows);
    expect(await service.getAllCategories(USER_ID)).toEqual(rows);
    expect(model.getAll).toHaveBeenCalledWith(USER_ID);
  });

  test('list rejects invalid user', async () => {
    await expect(service.getAllCategories(0)).rejects.toBeInstanceOf(ValidationError);
  });

  test('getById rejects non-numeric id', async () => {
    await expect(service.getCategoryById('abc', USER_ID)).rejects.toBeInstanceOf(ValidationError);
  });

  test('getById rejects zero', async () => {
    await expect(service.getCategoryById(0, USER_ID)).rejects.toBeInstanceOf(ValidationError);
  });

  test('getById throws NotFound when row missing (or owned by another user)', async () => {
    model.getById.mockResolvedValue(undefined);
    await expect(service.getCategoryById(99, USER_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(model.getById).toHaveBeenCalledWith(99, USER_ID);
  });

  test('getById returns the row when found', async () => {
    model.getById.mockResolvedValue({ id: 5, name: 'Bills', user_id: USER_ID });
    expect(await service.getCategoryById(5, USER_ID))
      .toEqual({ id: 5, name: 'Bills', user_id: USER_ID });
  });
});

describe('categoryService — create', () => {
  afterEach(() => jest.clearAllMocks());

  test('rejects empty name', async () => {
    await expect(service.createCategory(USER_ID, '   ', '#ff0000'))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects non-string name', async () => {
    await expect(service.createCategory(USER_ID, null, '#ff0000'))
      .rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects name longer than 100 chars', async () => {
    await expect(service.createCategory(USER_ID, 'a'.repeat(101), '#ff0000'))
      .rejects.toThrow(/at most 100/);
  });

  test('trims name and passes user_id to model', async () => {
    model.create.mockResolvedValue({ id: 1, name: 'Food', color: '#ff0000', user_id: USER_ID });
    await service.createCategory(USER_ID, '  Food  ', '#ff0000');
    expect(model.create).toHaveBeenCalledWith(USER_ID, 'Food', '#ff0000');
  });

  test('falls back to default color when invalid', async () => {
    model.create.mockResolvedValue({ id: 1 });
    await service.createCategory(USER_ID, 'Food', 'red');
    expect(model.create).toHaveBeenCalledWith(USER_ID, 'Food', '#cccccc');
  });

  test('falls back to default color when missing', async () => {
    model.create.mockResolvedValue({ id: 1 });
    await service.createCategory(USER_ID, 'Food', undefined);
    expect(model.create).toHaveBeenCalledWith(USER_ID, 'Food', '#cccccc');
  });

  test('accepts valid hex color', async () => {
    model.create.mockResolvedValue({ id: 1 });
    await service.createCategory(USER_ID, 'Food', '#3498db');
    expect(model.create).toHaveBeenCalledWith(USER_ID, 'Food', '#3498db');
  });
});

describe('categoryService — update', () => {
  afterEach(() => jest.clearAllMocks());

  test('throws NotFound when category does not exist for this user', async () => {
    model.getById.mockResolvedValue(undefined);
    await expect(service.updateCategory(42, USER_ID, 'New', '#000000'))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  test('updates row when valid', async () => {
    model.getById.mockResolvedValue({ id: 7, name: 'Old', user_id: USER_ID });
    model.update.mockResolvedValue({ id: 7, name: 'New', color: '#ff0000', user_id: USER_ID });
    const result = await service.updateCategory(7, USER_ID, 'New', '#ff0000');
    expect(result).toMatchObject({ id: 7, name: 'New', color: '#ff0000' });
    expect(model.update).toHaveBeenCalledWith(7, USER_ID, 'New', '#ff0000');
  });

  test('rejects invalid id before checking existence', async () => {
    await expect(service.updateCategory('foo', USER_ID, 'Name', '#000000'))
      .rejects.toBeInstanceOf(ValidationError);
    expect(model.getById).not.toHaveBeenCalled();
  });
});

describe('categoryService — delete', () => {
  afterEach(() => jest.clearAllMocks());

  test('removes existing row scoped by user', async () => {
    model.getById.mockResolvedValue({ id: 3, user_id: USER_ID });
    await service.deleteCategory(3, USER_ID);
    expect(model.remove).toHaveBeenCalledWith(3, USER_ID);
  });

  test('throws NotFound when row missing (or another user owns it)', async () => {
    model.getById.mockResolvedValue(undefined);
    await expect(service.deleteCategory(8, USER_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(model.remove).not.toHaveBeenCalled();
  });
});
