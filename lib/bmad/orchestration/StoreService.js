
class StoreService {
  constructor(store) {
    this.store = store;
  }

  dispatch(type, payload) {
    if (this.store) {
      this.store.dispatch({ type, payload });
    }
  }
}

module.exports = { StoreService };
