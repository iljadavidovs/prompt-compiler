export default class Manager {
    constructor(initialState = {}) {
        this.state = initialState;
        this.listeners = new Set();
    }

    getState() {
        return this.state;
    }

    setState(newState) {
        this.state = Object.freeze({ ...this.state, ...newState });
        this.notify();
    }

    subscribe(listener, selector = state => state) {
        let previousSlice = selector(this.state);

        const wrappedListener = (state) => {
            const currentSlice = selector(state);
            if (previousSlice !== currentSlice) {
                listener(currentSlice);
                previousSlice = currentSlice;
            }
        };

        this.listeners.add(wrappedListener);
        listener(previousSlice);
        return () => this.listeners.delete(wrappedListener);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }
}
