
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function comment(content) {
        return document.createComment(content);
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function select_option(select, value, mounting) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        if (!mounting || value !== undefined) {
            select.selectedIndex = -1; // no option should be selected
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked');
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Schedules a callback to run immediately after the component has been updated.
     *
     * The first time the callback runs will be after the initial `onMount`
     */
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        const updates = [];
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                // defer updates until all the DOM shuffling is done
                updates.push(() => block.p(child_ctx, dirty));
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        run_all(updates);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const user = writable(null);
    const userid = writable(null);
    const token = writable(null);
    const isLoggedIn = writable(false);
    const showOptions = writable(true); //Mostrar o no, las opciones del chatbot
    const selectedOption = writable(null); //Opcion seleccionada

        // Función para manejar el inicio de sesión
    async function login(email, password) {
        const response = await fetch('http://127.0.0.1:5000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();
        if (response.ok) {
            localStorage.setItem('jwt_token', result.access_token);  // Guardar token
            let fullname= result.nombre;
            token.set(result.access_token);
            user.set(fullname);
            userid.set(result.id);
            isLoggedIn.set(true);
            window.location.reload();
        } else {
            return result.message;
        }
    }

    /* src/components/History.svelte generated by Svelte v3.59.2 */
    const file$a = "src/components/History.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (44:2) {:else}
    function create_else_block$5(ctx) {
    	let div;
    	let p;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			p.textContent = "Inicia sesión para acceder a esta sección";
    			attr_dev(p, "class", "msgLogin svelte-1tv4kro");
    			add_location(p, file$a, 44, 29, 1412);
    			attr_dev(div, "class", "msgLoginSect svelte-1tv4kro");
    			add_location(div, file$a, 44, 3, 1386);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$5.name,
    		type: "else",
    		source: "(44:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (34:2) {#if loggedIn}
    function create_if_block$7(ctx) {
    	let show_if = !/*dates*/ ctx[1].find(/*func*/ ctx[4]);
    	let t;
    	let each_1_anchor;
    	let if_block = show_if && create_if_block_1$5(ctx);
    	let each_value = /*dates*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, t, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*dates*/ 2) show_if = !/*dates*/ ctx[1].find(/*func*/ ctx[4]);

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$5(ctx);
    					if_block.c();
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*selectDate, dates*/ 10) {
    				each_value = /*dates*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(34:2) {#if loggedIn}",
    		ctx
    	});

    	return block;
    }

    // (35:3) {#if !dates.find(d => d.original === today)}
    function create_if_block_1$5(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");

    			button.textContent = `${new Date().toLocaleDateString("es-ES", {
				day: "numeric",
				month: "long",
				year: "numeric"
			})}`;

    			attr_dev(button, "class", "btn btn-primary svelte-1tv4kro");
    			add_location(button, file$a, 35, 4, 1058);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", reloadPage, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(35:3) {#if !dates.find(d => d.original === today)}",
    		ctx
    	});

    	return block;
    }

    // (41:3) {#each dates as date}
    function create_each_block$1(ctx) {
    	let button;
    	let t_value = /*date*/ ctx[9].beauty + "";
    	let t;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[5](/*date*/ ctx[9]);
    	}

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(t_value);
    			attr_dev(button, "class", "btn btn-primary svelte-1tv4kro");
    			add_location(button, file$a, 41, 4, 1264);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler, false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*dates*/ 2 && t_value !== (t_value = /*date*/ ctx[9].beauty + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(41:3) {#each dates as date}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let div1;
    	let h3;
    	let t1;
    	let div0;

    	function select_block_type(ctx, dirty) {
    		if (/*loggedIn*/ ctx[0]) return create_if_block$7;
    		return create_else_block$5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h3 = element("h3");
    			h3.textContent = "Historial";
    			t1 = space();
    			div0 = element("div");
    			if_block.c();
    			attr_dev(h3, "class", "history_title svelte-1tv4kro");
    			add_location(h3, file$a, 31, 1, 917);
    			attr_dev(div0, "class", "history_content svelte-1tv4kro");
    			add_location(div0, file$a, 32, 1, 959);
    			attr_dev(div1, "class", "history svelte-1tv4kro");
    			add_location(div1, file$a, 30, 0, 894);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h3);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			if_block.m(div0, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function reloadPage() {
    	location.reload();
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('History', slots, []);
    	const dispatch = createEventDispatcher();
    	let loggedIn; //Esta logueado?
    	let userId; //id del usuario

    	isLoggedIn.subscribe(value => {
    		$$invalidate(0, loggedIn = value);
    	});

    	userid.subscribe(value => {
    		userId = value;
    	});

    	let dates = [];
    	let today = new Date().toISOString().split("T")[0]; // fecha de hoy yyyy-mm-dd

    	async function loadDates() {
    		const res = await fetch(`http://127.0.0.1:5000/dates?user_id=${userId}`);
    		$$invalidate(1, dates = await res.json());
    	}

    	// Solo carga fechas si el usuario está logueado
    	onMount(() => {
    		if (loggedIn) {
    			loadDates();
    		}
    	});

    	function selectDate(date) {
    		dispatch("selectedDate", date); // Enviar fecha al componente padre
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<History> was created with unknown prop '${key}'`);
    	});

    	const func = d => d.original === today;
    	const click_handler = date => selectDate(date.original);

    	$$self.$capture_state = () => ({
    		onMount,
    		isLoggedIn,
    		userid,
    		createEventDispatcher,
    		dispatch,
    		loggedIn,
    		userId,
    		dates,
    		today,
    		loadDates,
    		selectDate,
    		reloadPage
    	});

    	$$self.$inject_state = $$props => {
    		if ('loggedIn' in $$props) $$invalidate(0, loggedIn = $$props.loggedIn);
    		if ('userId' in $$props) userId = $$props.userId;
    		if ('dates' in $$props) $$invalidate(1, dates = $$props.dates);
    		if ('today' in $$props) $$invalidate(2, today = $$props.today);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [loggedIn, dates, today, selectDate, func, click_handler];
    }

    class History extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "History",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* src/components/MessageBlock.svelte generated by Svelte v3.59.2 */
    const file$9 = "src/components/MessageBlock.svelte";

    // (38:2) {#if message.type === 1 && showOpt && lastMessage && !locked}
    function create_if_block_2$4(ctx) {
    	let div;
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let button2;
    	let t5;
    	let button3;
    	let t7;
    	let button4;
    	let t9;
    	let button5;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button0 = element("button");
    			button0.textContent = "📚 Información de la Biblioteca";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "📖 Buscar libros o recursos";
    			t3 = space();
    			button2 = element("button");
    			button2.textContent = "🧠 Recomendaciones bibliográficas";
    			t5 = space();
    			button3 = element("button");
    			button3.textContent = "📑 Crear informe o contenido";
    			t7 = space();
    			button4 = element("button");
    			button4.textContent = "📝 Resumir un recurso PDF";
    			t9 = space();
    			button5 = element("button");
    			button5.textContent = "❓ Hacer una consulta libre";
    			attr_dev(button0, "class", "btn btn-primary");
    			add_location(button0, file$9, 39, 4, 1661);
    			attr_dev(button1, "class", "btn btn-primary");
    			add_location(button1, file$9, 40, 4, 1805);
    			attr_dev(button2, "class", "btn btn-primary");
    			add_location(button2, file$9, 41, 4, 1941);
    			attr_dev(button3, "class", "btn btn-primary");
    			add_location(button3, file$9, 42, 4, 2089);
    			attr_dev(button4, "class", "btn btn-primary");
    			add_location(button4, file$9, 43, 4, 2227);
    			attr_dev(button5, "class", "btn btn-primary");
    			add_location(button5, file$9, 44, 4, 2359);
    			attr_dev(div, "class", "buttonsOpt");
    			add_location(div, file$9, 38, 3, 1632);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button0);
    			append_dev(div, t1);
    			append_dev(div, button1);
    			append_dev(div, t3);
    			append_dev(div, button2);
    			append_dev(div, t5);
    			append_dev(div, button3);
    			append_dev(div, t7);
    			append_dev(div, button4);
    			append_dev(div, t9);
    			append_dev(div, button5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[12], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[13], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler_2*/ ctx[14], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_3*/ ctx[15], false, false, false, false),
    					listen_dev(button4, "click", /*click_handler_4*/ ctx[16], false, false, false, false),
    					listen_dev(button5, "click", /*click_handler_5*/ ctx[17], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$4.name,
    		type: "if",
    		source: "(38:2) {#if message.type === 1 && showOpt && lastMessage && !locked}",
    		ctx
    	});

    	return block;
    }

    // (48:2) {#if !selectedDate || selectedDate === today}
    function create_if_block$6(ctx) {
    	let if_block_anchor;
    	let if_block = /*lastMessage*/ ctx[2] && /*chatLength*/ ctx[3] > 1 && !/*showOpt*/ ctx[5] && !/*isAQuestion*/ ctx[6] && /*message*/ ctx[0].type === 1 && create_if_block_1$4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*lastMessage*/ ctx[2] && /*chatLength*/ ctx[3] > 1 && !/*showOpt*/ ctx[5] && !/*isAQuestion*/ ctx[6] && /*message*/ ctx[0].type === 1) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$4(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(48:2) {#if !selectedDate || selectedDate === today}",
    		ctx
    	});

    	return block;
    }

    // (49:3) {#if lastMessage && chatLength>1 && !showOpt && !isAQuestion && message.type === 1 }
    function create_if_block_1$4(ctx) {
    	let div;
    	let p;
    	let t0;
    	let strong;
    	let t2;
    	let t3;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			p = element("p");
    			t0 = text("¿Hay algo más en lo que te pueda ayudar sobre esta opción?, recuerda que no tengo acceso al contexto previo, es decir, ");
    			strong = element("strong");
    			strong.textContent = "no tengo memoria";
    			t2 = text(", ¿o deseas ver el Menú de Opciones? -->");
    			t3 = space();
    			button = element("button");
    			button.textContent = "Ver Opciones";
    			add_location(strong, file$9, 50, 146, 2821);
    			attr_dev(p, "class", "extra-text svelte-15drrj2");
    			add_location(p, file$9, 50, 5, 2680);
    			attr_dev(button, "class", "btn btn-primary extra svelte-15drrj2");
    			add_location(button, file$9, 51, 5, 2904);
    			attr_dev(div, "class", "extra-message svelte-15drrj2");
    			add_location(div, file$9, 49, 4, 2647);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, p);
    			append_dev(p, t0);
    			append_dev(p, strong);
    			append_dev(p, t2);
    			append_dev(div, t3);
    			append_dev(div, button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler_6*/ ctx[18], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(49:3) {#if lastMessage && chatLength>1 && !showOpt && !isAQuestion && message.type === 1 }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div1;
    	let img;
    	let img_src_value;
    	let t0;
    	let section;
    	let div0;
    	let span;
    	let raw_value = /*message*/ ctx[0].message + "";
    	let t1;
    	let t2;
    	let section_class_value;
    	let div1_class_value;
    	let if_block0 = /*message*/ ctx[0].type === 1 && /*showOpt*/ ctx[5] && /*lastMessage*/ ctx[2] && !/*locked*/ ctx[1] && create_if_block_2$4(ctx);
    	let if_block1 = (!/*selectedDate*/ ctx[4] || /*selectedDate*/ ctx[4] === /*today*/ ctx[9]) && create_if_block$6(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			section = element("section");
    			div0 = element("div");
    			span = element("span");
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(img, "class", "avatar svelte-15drrj2");

    			if (!src_url_equal(img.src, img_src_value = /*message*/ ctx[0].type === 0
    			? /*user_avatar*/ ctx[8]
    			: /*bagbot_avatar*/ ctx[7])) attr_dev(img, "src", img_src_value);

    			attr_dev(img, "alt", "avatar");
    			add_location(img, file$9, 33, 1, 1261);
    			add_location(span, file$9, 36, 53, 1522);
    			attr_dev(div0, "class", "mensaje");
    			toggle_class(div0, "noshowOpt", /*lastMessage*/ ctx[2]);
    			add_location(div0, file$9, 36, 2, 1471);

    			attr_dev(section, "class", section_class_value = "" + (null_to_empty(`${/*message*/ ctx[0].type === 0
			? 'message own-message'
			: 'message'} ${/*showOpt*/ ctx[5] ? 'messageColumn' : ''}`) + " svelte-15drrj2"));

    			add_location(section, file$9, 34, 1, 1353);
    			attr_dev(div1, "class", div1_class_value = "container " + (/*message*/ ctx[0].type === 0 ? 'own-container' : '') + " svelte-15drrj2");
    			add_location(div1, file$9, 32, 0, 1192);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, section);
    			append_dev(section, div0);
    			append_dev(div0, span);
    			span.innerHTML = raw_value;
    			append_dev(section, t1);
    			if (if_block0) if_block0.m(section, null);
    			append_dev(section, t2);
    			if (if_block1) if_block1.m(section, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*message*/ 1 && !src_url_equal(img.src, img_src_value = /*message*/ ctx[0].type === 0
    			? /*user_avatar*/ ctx[8]
    			: /*bagbot_avatar*/ ctx[7])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*message*/ 1 && raw_value !== (raw_value = /*message*/ ctx[0].message + "")) span.innerHTML = raw_value;
    			if (dirty & /*lastMessage*/ 4) {
    				toggle_class(div0, "noshowOpt", /*lastMessage*/ ctx[2]);
    			}

    			if (/*message*/ ctx[0].type === 1 && /*showOpt*/ ctx[5] && /*lastMessage*/ ctx[2] && !/*locked*/ ctx[1]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2$4(ctx);
    					if_block0.c();
    					if_block0.m(section, t2);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (!/*selectedDate*/ ctx[4] || /*selectedDate*/ ctx[4] === /*today*/ ctx[9]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$6(ctx);
    					if_block1.c();
    					if_block1.m(section, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*message, showOpt*/ 33 && section_class_value !== (section_class_value = "" + (null_to_empty(`${/*message*/ ctx[0].type === 0
			? 'message own-message'
			: 'message'} ${/*showOpt*/ ctx[5] ? 'messageColumn' : ''}`) + " svelte-15drrj2"))) {
    				attr_dev(section, "class", section_class_value);
    			}

    			if (dirty & /*message*/ 1 && div1_class_value !== (div1_class_value = "container " + (/*message*/ ctx[0].type === 0 ? 'own-container' : '') + " svelte-15drrj2")) {
    				attr_dev(div1, "class", div1_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let isAQuestion;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MessageBlock', slots, []);
    	let bagbot_avatar = './assets/bagbot.png';
    	let user_avatar = './assets/user.png';
    	const dispatch = createEventDispatcher();
    	let { message } = $$props;
    	let { locked = false } = $$props;
    	let { lastMessage = false } = $$props;
    	let { chatLength = 0 } = $$props;
    	let { selectedDate = null } = $$props;
    	let today = new Date().toISOString().split("T")[0];
    	let showOpt;

    	showOptions.subscribe(value => {
    		$$invalidate(5, showOpt = value);
    	});

    	function optionSelected(option) {
    		selectedOption.set(option);
    		showOptions.set(false);
    		dispatch('optionSel', { option });
    	}

    	function optionSelectedMenu(option) {
    		selectedOption.set(option);
    		showOptions.set(true);
    		dispatch('optionSel', { option });
    	}

    	$$self.$$.on_mount.push(function () {
    		if (message === undefined && !('message' in $$props || $$self.$$.bound[$$self.$$.props['message']])) {
    			console.warn("<MessageBlock> was created without expected prop 'message'");
    		}
    	});

    	const writable_props = ['message', 'locked', 'lastMessage', 'chatLength', 'selectedDate'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MessageBlock> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => optionSelected("📚 Información de la Biblioteca");
    	const click_handler_1 = () => optionSelected("📖 Buscar libros o recursos");
    	const click_handler_2 = () => optionSelected("🧠 Recomendaciones bibliográficas");
    	const click_handler_3 = () => optionSelected("📑 Crear informe o contenido");
    	const click_handler_4 = () => optionSelected("📝 Resumir un recurso PDF");
    	const click_handler_5 = () => optionSelected("❓ Hacer una consulta libre");
    	const click_handler_6 = () => optionSelectedMenu("Ver Opciones");

    	$$self.$$set = $$props => {
    		if ('message' in $$props) $$invalidate(0, message = $$props.message);
    		if ('locked' in $$props) $$invalidate(1, locked = $$props.locked);
    		if ('lastMessage' in $$props) $$invalidate(2, lastMessage = $$props.lastMessage);
    		if ('chatLength' in $$props) $$invalidate(3, chatLength = $$props.chatLength);
    		if ('selectedDate' in $$props) $$invalidate(4, selectedDate = $$props.selectedDate);
    	};

    	$$self.$capture_state = () => ({
    		bagbot_avatar,
    		user_avatar,
    		showOptions,
    		selectedOption,
    		createEventDispatcher,
    		dispatch,
    		message,
    		locked,
    		lastMessage,
    		chatLength,
    		selectedDate,
    		today,
    		showOpt,
    		optionSelected,
    		optionSelectedMenu,
    		isAQuestion
    	});

    	$$self.$inject_state = $$props => {
    		if ('bagbot_avatar' in $$props) $$invalidate(7, bagbot_avatar = $$props.bagbot_avatar);
    		if ('user_avatar' in $$props) $$invalidate(8, user_avatar = $$props.user_avatar);
    		if ('message' in $$props) $$invalidate(0, message = $$props.message);
    		if ('locked' in $$props) $$invalidate(1, locked = $$props.locked);
    		if ('lastMessage' in $$props) $$invalidate(2, lastMessage = $$props.lastMessage);
    		if ('chatLength' in $$props) $$invalidate(3, chatLength = $$props.chatLength);
    		if ('selectedDate' in $$props) $$invalidate(4, selectedDate = $$props.selectedDate);
    		if ('today' in $$props) $$invalidate(9, today = $$props.today);
    		if ('showOpt' in $$props) $$invalidate(5, showOpt = $$props.showOpt);
    		if ('isAQuestion' in $$props) $$invalidate(6, isAQuestion = $$props.isAQuestion);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*message*/ 1) {
    			// Evaluar si el mensaje contiene "Indicame tu consulta por favor" o "PDF procesado con éxito" para no mostrar el boton de ver opciones
    			$$invalidate(6, isAQuestion = message.message.includes("Seleccionaste la opción") || message.message.includes("PDF procesado con éxito"));
    		}
    	};

    	return [
    		message,
    		locked,
    		lastMessage,
    		chatLength,
    		selectedDate,
    		showOpt,
    		isAQuestion,
    		bagbot_avatar,
    		user_avatar,
    		today,
    		optionSelected,
    		optionSelectedMenu,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6
    	];
    }

    class MessageBlock extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {
    			message: 0,
    			locked: 1,
    			lastMessage: 2,
    			chatLength: 3,
    			selectedDate: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MessageBlock",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get message() {
    		throw new Error("<MessageBlock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set message(value) {
    		throw new Error("<MessageBlock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get locked() {
    		throw new Error("<MessageBlock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set locked(value) {
    		throw new Error("<MessageBlock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get lastMessage() {
    		throw new Error("<MessageBlock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set lastMessage(value) {
    		throw new Error("<MessageBlock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get chatLength() {
    		throw new Error("<MessageBlock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set chatLength(value) {
    		throw new Error("<MessageBlock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedDate() {
    		throw new Error("<MessageBlock>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedDate(value) {
    		throw new Error("<MessageBlock>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Chatbox.svelte generated by Svelte v3.59.2 */

    const { console: console_1$1 } = globals;

    const file_1 = "src/components/Chatbox.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[38] = list[i];
    	child_ctx[42] = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[38] = list[i];
    	return child_ctx;
    }

    // (256:8) {:else}
    function create_else_block_1$2(ctx) {
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let each_value_1 = /*chat*/ ctx[2];
    	validate_each_argument(each_value_1);
    	const get_key = ctx => /*i*/ ctx[42];
    	validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		let child_ctx = get_each_context_1(ctx, each_value_1, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*chat, locked, selectedDate, optionSelected*/ 32775) {
    				each_value_1 = /*chat*/ ctx[2];
    				validate_each_argument(each_value_1);
    				group_outros();
    				validate_each_keys(ctx, each_value_1, get_each_context_1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block_1, each_1_anchor, get_each_context_1);
    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$2.name,
    		type: "else",
    		source: "(256:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (252:8) {#if chat.length === 0}
    function create_if_block_3$2(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value = /*chatInit*/ ctx[12];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(target, anchor);
    				}
    			}

    			insert_dev(target, each_1_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*chatInit, optionSelected*/ 36864) {
    				each_value = /*chatInit*/ ctx[12];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$2.name,
    		type: "if",
    		source: "(252:8) {#if chat.length === 0}",
    		ctx
    	});

    	return block;
    }

    // (257:12) {#each chat as message, i (i)}
    function create_each_block_1(key_1, ctx) {
    	let first;
    	let messageblock;
    	let current;

    	messageblock = new MessageBlock({
    			props: {
    				message: /*message*/ ctx[38],
    				locked: /*locked*/ ctx[1],
    				lastMessage: /*i*/ ctx[42] === /*chat*/ ctx[2].length - 1,
    				chatLength: /*chat*/ ctx[2].length,
    				selectedDate: /*selectedDate*/ ctx[0]
    			},
    			$$inline: true
    		});

    	messageblock.$on("optionSel", /*optionSelected*/ ctx[15]);

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			first = empty();
    			create_component(messageblock.$$.fragment);
    			this.first = first;
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, first, anchor);
    			mount_component(messageblock, target, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const messageblock_changes = {};
    			if (dirty[0] & /*chat*/ 4) messageblock_changes.message = /*message*/ ctx[38];
    			if (dirty[0] & /*locked*/ 2) messageblock_changes.locked = /*locked*/ ctx[1];
    			if (dirty[0] & /*chat*/ 4) messageblock_changes.lastMessage = /*i*/ ctx[42] === /*chat*/ ctx[2].length - 1;
    			if (dirty[0] & /*chat*/ 4) messageblock_changes.chatLength = /*chat*/ ctx[2].length;
    			if (dirty[0] & /*selectedDate*/ 1) messageblock_changes.selectedDate = /*selectedDate*/ ctx[0];
    			messageblock.$set(messageblock_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(messageblock.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(messageblock.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(first);
    			destroy_component(messageblock, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(257:12) {#each chat as message, i (i)}",
    		ctx
    	});

    	return block;
    }

    // (253:12) {#each chatInit as message}
    function create_each_block(ctx) {
    	let messageblock;
    	let current;

    	messageblock = new MessageBlock({
    			props: {
    				message: /*message*/ ctx[38],
    				lastMessage: "true"
    			},
    			$$inline: true
    		});

    	messageblock.$on("optionSel", /*optionSelected*/ ctx[15]);

    	const block = {
    		c: function create() {
    			create_component(messageblock.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(messageblock, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(messageblock.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(messageblock.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(messageblock, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(253:12) {#each chatInit as message}",
    		ctx
    	});

    	return block;
    }

    // (261:8) {#if isThinking}
    function create_if_block_2$3(ctx) {
    	let div;
    	let span0;
    	let span1;
    	let span2;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span0 = element("span");
    			span1 = element("span");
    			span2 = element("span");
    			attr_dev(span0, "class", "svelte-rf0xx5");
    			add_location(span0, file_1, 262, 16, 9351);
    			attr_dev(span1, "class", "svelte-rf0xx5");
    			add_location(span1, file_1, 262, 29, 9364);
    			attr_dev(span2, "class", "svelte-rf0xx5");
    			add_location(span2, file_1, 262, 42, 9377);
    			attr_dev(div, "class", "thinking-dots svelte-rf0xx5");
    			add_location(div, file_1, 261, 12, 9307);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span0);
    			append_dev(div, span1);
    			append_dev(div, span2);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(261:8) {#if isThinking}",
    		ctx
    	});

    	return block;
    }

    // (278:8) {:else}
    function create_else_block$4(ctx) {
    	let input;
    	let input_disabled_value;
    	let t0;
    	let button;
    	let t1;
    	let button_disabled_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			t0 = space();
    			button = element("button");
    			t1 = text("Enviar");
    			attr_dev(input, "class", "input-box svelte-rf0xx5");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Escribe tu mensaje...");
    			input.disabled = input_disabled_value = /*showOpt*/ ctx[7] || /*locked*/ ctx[1];
    			add_location(input, file_1, 278, 12, 10412);
    			attr_dev(button, "class", "btn btn-primary");
    			button.disabled = button_disabled_value = /*showOpt*/ ctx[7] || /*locked*/ ctx[1];
    			add_location(button, file_1, 279, 12, 10602);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*userMessage*/ ctx[4]);
    			/*input_binding*/ ctx[24](input);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, button, anchor);
    			append_dev(button, t1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[23]),
    					listen_dev(input, "keydown", /*handleKeyPress*/ ctx[13], false, false, false, false),
    					listen_dev(button, "click", /*sendMessage*/ ctx[14], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*showOpt, locked*/ 130 && input_disabled_value !== (input_disabled_value = /*showOpt*/ ctx[7] || /*locked*/ ctx[1])) {
    				prop_dev(input, "disabled", input_disabled_value);
    			}

    			if (dirty[0] & /*userMessage*/ 16 && input.value !== /*userMessage*/ ctx[4]) {
    				set_input_value(input, /*userMessage*/ ctx[4]);
    			}

    			if (dirty[0] & /*showOpt, locked*/ 130 && button_disabled_value !== (button_disabled_value = /*showOpt*/ ctx[7] || /*locked*/ ctx[1])) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			/*input_binding*/ ctx[24](null);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(278:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (275:83) 
    function create_if_block_1$3(ctx) {
    	let button0;
    	let t1;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			button0.textContent = "Descargar";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Ver Opciones";
    			attr_dev(button0, "class", "btn btn-primary");
    			add_location(button0, file_1, 275, 12, 10192);
    			attr_dev(button1, "class", "btn btn-primary extra svelte-rf0xx5");
    			add_location(button1, file_1, 276, 12, 10279);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, button1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*downloadPDF*/ ctx[17], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[22], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(275:83) ",
    		ctx
    	});

    	return block;
    }

    // (268:8) {#if userOption === "📝 Resumir un recurso PDF" && !showButtonDownload}
    function create_if_block$5(ctx) {
    	let div;
    	let span;
    	let t0;
    	let div_class_value;
    	let t1;
    	let form;
    	let input;
    	let t2;
    	let button0;
    	let t4;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t0 = text(/*errorPDF*/ ctx[10]);
    			t1 = space();
    			form = element("form");
    			input = element("input");
    			t2 = space();
    			button0 = element("button");
    			button0.textContent = "Subir y Resumir";
    			t4 = space();
    			button1 = element("button");
    			button1.textContent = "Ver Opciones";
    			add_location(span, file_1, 268, 72, 9621);
    			attr_dev(div, "class", div_class_value = "errorPDF " + (/*errorPDF*/ ctx[10].length > 0 ? '' : 'noShow') + " svelte-rf0xx5");
    			add_location(div, file_1, 268, 12, 9561);
    			attr_dev(input, "class", "input-box svelte-rf0xx5");
    			attr_dev(input, "type", "file");
    			attr_dev(input, "name", "file");
    			attr_dev(input, "accept", "application/pdf");
    			add_location(input, file_1, 270, 16, 9748);
    			attr_dev(button0, "class", "btn btn-primary");
    			attr_dev(button0, "type", "submit");
    			add_location(button0, file_1, 271, 16, 9884);
    			attr_dev(button1, "class", "btn btn-primary extra svelte-rf0xx5");
    			add_location(button1, file_1, 272, 16, 9971);
    			attr_dev(form, "class", "input-container svelte-rf0xx5");
    			add_location(form, file_1, 269, 12, 9663);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(span, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, form, anchor);
    			append_dev(form, input);
    			append_dev(form, t2);
    			append_dev(form, button0);
    			append_dev(form, t4);
    			append_dev(form, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*change_handler*/ ctx[20], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler*/ ctx[21], false, false, false, false),
    					listen_dev(form, "submit", prevent_default(/*uploadPDF*/ ctx[16]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*errorPDF*/ 1024) set_data_dev(t0, /*errorPDF*/ ctx[10]);

    			if (dirty[0] & /*errorPDF*/ 1024 && div_class_value !== (div_class_value = "errorPDF " + (/*errorPDF*/ ctx[10].length > 0 ? '' : 'noShow') + " svelte-rf0xx5")) {
    				attr_dev(div, "class", div_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(form);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(268:8) {#if userOption === \\\"📝 Resumir un recurso PDF\\\" && !showButtonDownload}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div2;
    	let div0;
    	let current_block_type_index;
    	let if_block0;
    	let t0;
    	let t1;
    	let div1;
    	let current;
    	const if_block_creators = [create_if_block_3$2, create_else_block_1$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*chat*/ ctx[2].length === 0) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let if_block1 = /*isThinking*/ ctx[6] && create_if_block_2$3(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*userOption*/ ctx[8] === "📝 Resumir un recurso PDF" && !/*showButtonDownload*/ ctx[11]) return create_if_block$5;
    		if (/*userOption*/ ctx[8] === "📝 Resumir un recurso PDF" && /*showButtonDownload*/ ctx[11]) return create_if_block_1$3;
    		return create_else_block$4;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block2 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			div1 = element("div");
    			if_block2.c();
    			attr_dev(div0, "class", "messages svelte-rf0xx5");
    			add_location(div0, file_1, 250, 4, 8782);
    			attr_dev(div1, "class", "input-container svelte-rf0xx5");
    			add_location(div1, file_1, 266, 4, 9439);
    			attr_dev(div2, "class", "chatbox svelte-rf0xx5");
    			add_location(div2, file_1, 249, 0, 8756);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			if_blocks[current_block_type_index].m(div0, null);
    			append_dev(div0, t0);
    			if (if_block1) if_block1.m(div0, null);
    			/*div0_binding*/ ctx[19](div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			if_block2.m(div1, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block0 = if_blocks[current_block_type_index];

    				if (!if_block0) {
    					if_block0 = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block0.c();
    				} else {
    					if_block0.p(ctx, dirty);
    				}

    				transition_in(if_block0, 1);
    				if_block0.m(div0, t0);
    			}

    			if (/*isThinking*/ ctx[6]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_2$3(ctx);
    					if_block1.c();
    					if_block1.m(div0, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block2) {
    				if_block2.p(ctx, dirty);
    			} else {
    				if_block2.d(1);
    				if_block2 = current_block_type(ctx);

    				if (if_block2) {
    					if_block2.c();
    					if_block2.m(div1, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if_blocks[current_block_type_index].d();
    			if (if_block1) if_block1.d();
    			/*div0_binding*/ ctx[19](null);
    			if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Chatbox', slots, []);
    	let { selectedDate = null } = $$props;
    	let { locked = false } = $$props;
    	let loggedIn; //Esta logueado?
    	let userId; //id del usuario
    	let name = ''; //name
    	let userMessage = ""; // Input del usuario
    	let inputRef; // referencia al input
    	let chat = []; // Arreglo para almacenar la conversación
    	let isThinking = false; //Para saber si el chatbot esta pensando
    	let chatEnd = null; //Carga el final del chat

    	isLoggedIn.subscribe(value => {
    		loggedIn = value;
    	});

    	user.subscribe(value => {
    		name = value;
    	});

    	userid.subscribe(value => {
    		userId = value;
    	});

    	let userName = name;

    	let chatInit = [
    		{
    			"type": 1,
    			"message": "👋 Hola" + (userName ? " " + userName.split(" ")[0] : "") + ", mi nombre es Bagbot y soy tu asistente de biblioteca virtual, por favor sé lo más claro y específico posible. Estoy aquí para ayudarte,<br> ¿Qué deseas hacer hoy?"
    		}
    	];

    	let showOpt;

    	showOptions.subscribe(value => {
    		$$invalidate(7, showOpt = value);
    	});

    	let userOption;

    	selectedOption.subscribe(value => {
    		$$invalidate(8, userOption = value);
    	});

    	async function getChat_DB_byDate(date) {
    		const res = await fetch(`http://127.0.0.1:5000/query/${date}?user_id=${userId}`);
    		$$invalidate(2, chat = await res.json());
    	}

    	// Función para enviar el mensaje al JSON
    	async function sendMessage_JSON() {
    		$$invalidate(6, isThinking = true);

    		const response = await fetch('http://127.0.0.1:5000/send-message-json', {
    			method: 'POST',
    			headers: { 'Content-Type': 'application/json' },
    			body: JSON.stringify({ message: userMessage })
    		});

    		const data = await response.json();
    		$$invalidate(6, isThinking = false); // 👈 OCULTA los puntitos cuando llega respuesta
    		$$invalidate(2, chat = data); // Actualizar la conversación con la respuesta del servidor
    		$$invalidate(4, userMessage = ""); // Limpiar el input después de enviar el mensaje
    	}

    	//Para guardarlo en la bd
    	async function sendMessage_DB() {
    		$$invalidate(6, isThinking = true);
    		const data = { userId, name, userMessage };

    		try {
    			const res = await fetch('http://127.0.0.1:5000/send-message-db', {
    				method: 'POST',
    				headers: { 'Content-Type': 'application/json' },
    				body: JSON.stringify(data)
    			});

    			if (res.ok) {
    				await getChat_DB(false);
    				$$invalidate(4, userMessage = ""); // Limpiar el input después de enviar el mensaje
    			} else {
    				const err = await res.json();
    				console.log(err);
    			}
    		} catch(err) {
    			console.log(err);
    		} finally {
    			$$invalidate(6, isThinking = false); // 👈 OCULTA los puntitos cuando llega respuesta
    		}
    	}

    	// Función para obtener la conversación almacenada en el JSON
    	async function getChat_JSON() {
    		const respJ = await fetch('http://127.0.0.1:5000/get-chat-json');
    		const dataJ = await respJ.json();
    		$$invalidate(2, chat = dataJ);
    	}

    	// Función para obtener la conversación almacenada en bd
    	async function getChat_DB(firstTime) {
    		const resp = await fetch(`http://127.0.0.1:5000/get-chat-db?user_id=${userId}`);
    		const data = await resp.json();
    		$$invalidate(2, chat = data);

    		if (chat.length > 0 && firstTime) {
    			chat.push({
    				'type': 1,
    				'message': '👋 Bievenid@ de nuevo ' + userName + ', mi nombre es Bagbot y soy tu asistente de biblioteca virtual, por favor sé lo más claro y específico posible. Estoy aquí para ayudarte,<br>¿Qué deseas hacer hoy? <br>'
    			});
    		}
    	}

    	// Función para detectar la tecla Enter y enviar el mensaje
    	async function handleKeyPress(event) {
    		if (event.key === 'Enter') {
    			sendMessage(); // Llama a la función para enviar el mensaje
    		}
    	}

    	// Either afterUpdate()
    	afterUpdate(() => {
    		if (chat) scrollToBottom(chatEnd);
    	});

    	//Cargar al final del chat
    	const scrollToBottom = async node => {
    		node.scroll({
    			top: node.scrollHeight,
    			behavior: 'smooth'
    		});
    	};

    	//Enviar mensaje, aqui si esta logueado se guarda en la bd, sino en el archivo json
    	function sendMessage() {
    		if (!userMessage.trim()) {
    			// Si el mensaje está vacío o solo tiene espacios
    			inputRef.focus(); // hacer focus en el input

    			return;
    		}

    		if (loggedIn) {
    			sendMessage_DB();
    		} else {
    			sendMessage_JSON();
    		}
    	}

    	onMount(() => {
    		if (loggedIn) {
    			//Si esta logueado obtenemos la conversacion de la BD
    			getChat_DB(true); //true porque es primera vez que carga
    		} else {
    			//Sino obtenemos la conversacion del JSON
    			getChat_JSON();
    		}

    		scrollToBottom(); // Scroll inicial al montar
    	});

    	let option = '';

    	function optionSelected(event) {
    		option = event.detail.option;
    		sendOptionSelected(option);
    	}

    	async function sendOptionSelected(option) {
    		if (loggedIn) {
    			let first;

    			if (chat.length > 0) {
    				first = 0;
    			} else {
    				first = 1;
    			}

    			const values = { userId, name, userMessage, option, first };

    			//Si esta logueado obtenemos la conversacion de la BD
    			await fetch('http://127.0.0.1:5000/selected-option-chat-db', {
    				method: 'POST',
    				headers: { 'Content-Type': 'application/json' },
    				body: JSON.stringify(values)
    			});

    			getChat_DB(false);
    		} else {
    			await fetch('http://127.0.0.1:5000/selected-option-chat-json', {
    				method: 'POST',
    				headers: { 'Content-Type': 'application/json' },
    				body: JSON.stringify({ option })
    			});

    			//Sino obtenemos la conversacion del JSON
    			getChat_JSON();
    		}
    	}

    	let file;
    	let filename = '';
    	let errorPDF = '';
    	let showButtonDownload = false;

    	async function uploadPDF() {
    		if (!file) {
    			$$invalidate(10, errorPDF = 'Debes seleccionar un archivo PDF.');

    			setTimeout(
    				() => {
    					$$invalidate(10, errorPDF = '');
    				},
    				5000
    			);

    			return;
    		}

    		const formData = new FormData();
    		formData.append('file', file);
    		formData.append('userID', userId); // si necesitas enviar esto
    		formData.append('loggedIn', loggedIn);

    		try {
    			const res = await fetch('http://127.0.0.1:5000/upload-pdf', { method: 'POST', body: formData });
    			const data = await res.json();

    			if (!res.ok) {
    				$$invalidate(10, errorPDF = data.error || 'Error al procesar el PDF.');

    				setTimeout(
    					() => {
    						$$invalidate(10, errorPDF = '');
    					},
    					5000
    				);

    				return;
    			}

    			filename = data.filename;
    			$$invalidate(11, showButtonDownload = true);
    		} catch(e) {
    			$$invalidate(10, errorPDF = 'Error de conexión con el servidor.');

    			setTimeout(
    				() => {
    					$$invalidate(10, errorPDF = '');
    				},
    				5000
    			);
    		}

    		if (loggedIn) {
    			//Si esta logueado obtenemos la conversacion de la BD
    			getChat_DB(false);
    		} else {
    			//Sino obtenemos la conversacion del JSON
    			getChat_JSON();
    		}
    	}

    	async function downloadPDF() {
    		try {
    			const res = await fetch(`http://127.0.0.1:5000/download-pdf?filename=${filename}`);

    			if (!res.ok) {
    				$$invalidate(10, errorPDF = 'No se pudo descargar el resumen.');

    				setTimeout(
    					() => {
    						$$invalidate(10, errorPDF = '');
    					},
    					5000
    				);

    				return;
    			}

    			const blob = await res.blob();
    			const url = URL.createObjectURL(blob);
    			const a = document.createElement('a');
    			a.href = url;
    			a.download = `resumen_${filename}`;
    			document.body.appendChild(a);
    			a.click();
    			document.body.removeChild(a);
    			URL.revokeObjectURL(url);
    			$$invalidate(11, showButtonDownload = false); //Deshabilita el boton Descargar
    			optionsMenu('Ver Opciones'); //Mostrar Opciones
    		} catch(e) {
    			$$invalidate(10, errorPDF = 'Error al descargar el archivo.');

    			setTimeout(
    				() => {
    					$$invalidate(10, errorPDF = '');
    				},
    				5000
    			);
    		}
    	}

    	function optionsMenu(option) {
    		selectedOption.set(option);
    		showOptions.set(true);
    		sendOptionSelected(option);
    	}

    	const writable_props = ['selectedDate', 'locked'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Chatbox> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			chatEnd = $$value;
    			$$invalidate(3, chatEnd);
    		});
    	}

    	const change_handler = e => $$invalidate(9, file = e.target.files[0]);
    	const click_handler = () => optionsMenu("Ver Opciones");
    	const click_handler_1 = () => optionsMenu("Ver Opciones");

    	function input_input_handler() {
    		userMessage = this.value;
    		$$invalidate(4, userMessage);
    	}

    	function input_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			inputRef = $$value;
    			$$invalidate(5, inputRef);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('selectedDate' in $$props) $$invalidate(0, selectedDate = $$props.selectedDate);
    		if ('locked' in $$props) $$invalidate(1, locked = $$props.locked);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		afterUpdate,
    		MessageBlock,
    		user,
    		userid,
    		isLoggedIn,
    		showOptions,
    		selectedOption,
    		selectedDate,
    		locked,
    		loggedIn,
    		userId,
    		name,
    		userMessage,
    		inputRef,
    		chat,
    		isThinking,
    		chatEnd,
    		userName,
    		chatInit,
    		showOpt,
    		userOption,
    		getChat_DB_byDate,
    		sendMessage_JSON,
    		sendMessage_DB,
    		getChat_JSON,
    		getChat_DB,
    		handleKeyPress,
    		scrollToBottom,
    		sendMessage,
    		option,
    		optionSelected,
    		sendOptionSelected,
    		file,
    		filename,
    		errorPDF,
    		showButtonDownload,
    		uploadPDF,
    		downloadPDF,
    		optionsMenu
    	});

    	$$self.$inject_state = $$props => {
    		if ('selectedDate' in $$props) $$invalidate(0, selectedDate = $$props.selectedDate);
    		if ('locked' in $$props) $$invalidate(1, locked = $$props.locked);
    		if ('loggedIn' in $$props) loggedIn = $$props.loggedIn;
    		if ('userId' in $$props) userId = $$props.userId;
    		if ('name' in $$props) name = $$props.name;
    		if ('userMessage' in $$props) $$invalidate(4, userMessage = $$props.userMessage);
    		if ('inputRef' in $$props) $$invalidate(5, inputRef = $$props.inputRef);
    		if ('chat' in $$props) $$invalidate(2, chat = $$props.chat);
    		if ('isThinking' in $$props) $$invalidate(6, isThinking = $$props.isThinking);
    		if ('chatEnd' in $$props) $$invalidate(3, chatEnd = $$props.chatEnd);
    		if ('userName' in $$props) userName = $$props.userName;
    		if ('chatInit' in $$props) $$invalidate(12, chatInit = $$props.chatInit);
    		if ('showOpt' in $$props) $$invalidate(7, showOpt = $$props.showOpt);
    		if ('userOption' in $$props) $$invalidate(8, userOption = $$props.userOption);
    		if ('option' in $$props) option = $$props.option;
    		if ('file' in $$props) $$invalidate(9, file = $$props.file);
    		if ('filename' in $$props) filename = $$props.filename;
    		if ('errorPDF' in $$props) $$invalidate(10, errorPDF = $$props.errorPDF);
    		if ('showButtonDownload' in $$props) $$invalidate(11, showButtonDownload = $$props.showButtonDownload);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*selectedDate*/ 1) {
    			// Cargar mensajes si seleccionan una fecha
    			if (selectedDate) {
    				getChat_DB_byDate(selectedDate);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*chat, chatEnd*/ 12) {
    			if (chat && chatEnd) {
    				scrollToBottom(chatEnd);
    			}
    		}
    	};

    	return [
    		selectedDate,
    		locked,
    		chat,
    		chatEnd,
    		userMessage,
    		inputRef,
    		isThinking,
    		showOpt,
    		userOption,
    		file,
    		errorPDF,
    		showButtonDownload,
    		chatInit,
    		handleKeyPress,
    		sendMessage,
    		optionSelected,
    		uploadPDF,
    		downloadPDF,
    		optionsMenu,
    		div0_binding,
    		change_handler,
    		click_handler,
    		click_handler_1,
    		input_input_handler,
    		input_binding
    	];
    }

    class Chatbox extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { selectedDate: 0, locked: 1 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Chatbox",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get selectedDate() {
    		throw new Error("<Chatbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedDate(value) {
    		throw new Error("<Chatbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get locked() {
    		throw new Error("<Chatbox>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set locked(value) {
    		throw new Error("<Chatbox>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/Chat.svelte generated by Svelte v3.59.2 */
    const file$8 = "src/components/Chat.svelte";

    function create_fragment$8(ctx) {
    	let div2;
    	let div0;
    	let history;
    	let t;
    	let div1;
    	let chatbox;
    	let current;
    	history = new History({ $$inline: true });
    	history.$on("selectedDate", /*selectedDate_handler*/ ctx[3]);

    	chatbox = new Chatbox({
    			props: {
    				selectedDate: /*selectedDate*/ ctx[0],
    				locked: /*locked*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			create_component(history.$$.fragment);
    			t = space();
    			div1 = element("div");
    			create_component(chatbox.$$.fragment);
    			attr_dev(div0, "class", "left-panel svelte-161jo0f");
    			add_location(div0, file$8, 19, 4, 715);
    			attr_dev(div1, "class", "right-panel svelte-161jo0f");
    			add_location(div1, file$8, 22, 4, 829);
    			attr_dev(div2, "class", "container svelte-161jo0f");
    			add_location(div2, file$8, 18, 0, 687);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			mount_component(history, div0, null);
    			append_dev(div2, t);
    			append_dev(div2, div1);
    			mount_component(chatbox, div1, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const chatbox_changes = {};
    			if (dirty & /*selectedDate*/ 1) chatbox_changes.selectedDate = /*selectedDate*/ ctx[0];
    			if (dirty & /*locked*/ 2) chatbox_changes.locked = /*locked*/ ctx[1];
    			chatbox.$set(chatbox_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(history.$$.fragment, local);
    			transition_in(chatbox.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(history.$$.fragment, local);
    			transition_out(chatbox.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(history);
    			destroy_component(chatbox);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function isToday(date) {
    	const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    	return date === today;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Chat', slots, []);
    	let selectedDate = null; // Fecha seleccionada en history
    	let locked = false; // Bloquear input/botón cuando se selecciona historial

    	// Handler cuando se selecciona una fecha
    	function handleDateSelected(date) {
    		$$invalidate(0, selectedDate = date);
    		$$invalidate(1, locked = !isToday(date)); // Bloquea Chatbox para evitar nuevas consultas solo si la fecha no es hoy
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Chat> was created with unknown prop '${key}'`);
    	});

    	const selectedDate_handler = e => handleDateSelected(e.detail);

    	$$self.$capture_state = () => ({
    		History,
    		Chatbox,
    		selectedDate,
    		locked,
    		isToday,
    		handleDateSelected
    	});

    	$$self.$inject_state = $$props => {
    		if ('selectedDate' in $$props) $$invalidate(0, selectedDate = $$props.selectedDate);
    		if ('locked' in $$props) $$invalidate(1, locked = $$props.locked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [selectedDate, locked, handleDateSelected, selectedDate_handler];
    }

    class Chat extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Chat",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/components/Header.svelte generated by Svelte v3.59.2 */
    const file$7 = "src/components/Header.svelte";

    // (45:20) {:else}
    function create_else_block_1$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Bienvenid@");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(45:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (43:35) {#if loggedIn}
    function create_if_block_3$1(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			t0 = text("Bienvenid@ ");
    			t1 = text(/*userName*/ ctx[0]);
    			t2 = text(" - ");
    			t3 = text(/*userId*/ ctx[1]);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, t3, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*userName*/ 1) set_data_dev(t1, /*userName*/ ctx[0]);
    			if (dirty & /*userId*/ 2) set_data_dev(t3, /*userId*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(t3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(43:35) {#if loggedIn}",
    		ctx
    	});

    	return block;
    }

    // (51:16) {:else}
    function create_else_block$3(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Iniciar Sesión";
    			attr_dev(button, "class", "login svelte-q13c4s");
    			add_location(button, file$7, 51, 20, 1690);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*showLogin*/ ctx[3], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(51:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (49:16) {#if loggedIn}
    function create_if_block_2$2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Cerrar Sesión";
    			attr_dev(button, "class", "login svelte-q13c4s");
    			add_location(button, file$7, 49, 20, 1582);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*_logout*/ ctx[4], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(49:16) {#if loggedIn}",
    		ctx
    	});

    	return block;
    }

    // (66:12) {#if loggedIn==false}
    function create_if_block_1$2(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Inicio";
    			attr_dev(button, "class", "barOption system svelte-q13c4s");
    			add_location(button, file$7, 65, 33, 2477);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*main*/ ctx[5], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(66:12) {#if loggedIn==false}",
    		ctx
    	});

    	return block;
    }

    // (68:12) {#if loggedIn}
    function create_if_block$4(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Cerrar Sesión";
    			attr_dev(button, "class", "barOption system svelte-q13c4s");
    			add_location(button, file$7, 67, 26, 2697);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*_logout*/ ctx[4], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(68:12) {#if loggedIn}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let header;
    	let div6;
    	let div1;
    	let p0;
    	let t1;
    	let div0;
    	let p1;
    	let t2;
    	let t3;
    	let div4;
    	let img0;
    	let img0_src_value;
    	let t4;
    	let div2;
    	let img1;
    	let img1_src_value;
    	let t5;
    	let div3;
    	let img2;
    	let img2_src_value;
    	let t6;
    	let img3;
    	let img3_src_value;
    	let t7;
    	let div5;
    	let t8;
    	let a;
    	let t10;

    	function select_block_type(ctx, dirty) {
    		if (/*loggedIn*/ ctx[2]) return create_if_block_3$1;
    		return create_else_block_1$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*loggedIn*/ ctx[2]) return create_if_block_2$2;
    		return create_else_block$3;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);
    	let if_block2 = /*loggedIn*/ ctx[2] == false && create_if_block_1$2(ctx);
    	let if_block3 = /*loggedIn*/ ctx[2] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			header = element("header");
    			div6 = element("div");
    			div1 = element("div");
    			p0 = element("p");
    			p0.textContent = "BAG - Bliblioteca Alonso Gamero - UCV";
    			t1 = space();
    			div0 = element("div");
    			p1 = element("p");
    			if_block0.c();
    			t2 = space();
    			if_block1.c();
    			t3 = space();
    			div4 = element("div");
    			img0 = element("img");
    			t4 = space();
    			div2 = element("div");
    			img1 = element("img");
    			t5 = space();
    			div3 = element("div");
    			img2 = element("img");
    			t6 = space();
    			img3 = element("img");
    			t7 = space();
    			div5 = element("div");
    			if (if_block2) if_block2.c();
    			t8 = space();
    			a = element("a");
    			a.textContent = "Volver al sistema BAG";
    			t10 = space();
    			if (if_block3) if_block3.c();
    			attr_dev(p0, "class", "svelte-q13c4s");
    			add_location(p0, file$7, 40, 12, 1243);
    			attr_dev(p1, "class", "welcome svelte-q13c4s");
    			add_location(p1, file$7, 42, 16, 1338);
    			attr_dev(div0, "class", "lastTop svelte-q13c4s");
    			add_location(div0, file$7, 41, 12, 1300);
    			attr_dev(div1, "class", "header svelte-q13c4s");
    			add_location(div1, file$7, 39, 8, 1210);
    			attr_dev(img0, "class", "logoBag svelte-q13c4s");
    			if (!src_url_equal(img0.src, img0_src_value = "./assets/logoBag.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "logoBag");
    			add_location(img0, file$7, 56, 12, 1851);
    			attr_dev(img1, "class", "logoBagbot svelte-q13c4s");
    			if (!src_url_equal(img1.src, img1_src_value = "./assets/logo-BagBot.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "logoBagBot");
    			add_location(img1, file$7, 58, 36, 2092);
    			attr_dev(div2, "class", "nameBagbot");
    			add_location(div2, file$7, 58, 12, 2068);
    			attr_dev(img2, "class", "logoCiens svelte-q13c4s");
    			if (!src_url_equal(img2.src, img2_src_value = "./assets/ciencias.jpeg")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "logoCiencias");
    			add_location(img2, file$7, 60, 16, 2225);
    			attr_dev(img3, "class", "logoUCV svelte-q13c4s");
    			if (!src_url_equal(img3.src, img3_src_value = "./assets/ucv-logo.svg")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "logoUCV");
    			add_location(img3, file$7, 61, 16, 2315);
    			attr_dev(div3, "class", "lastLogos");
    			add_location(div3, file$7, 59, 12, 2185);
    			attr_dev(div4, "class", "top svelte-q13c4s");
    			add_location(div4, file$7, 55, 8, 1821);
    			attr_dev(a, "href", "https://sidneyli1994.github.io/bagbot-home-local/");
    			attr_dev(a, "class", "barOption backBag svelte-q13c4s");
    			add_location(a, file$7, 66, 12, 2559);
    			attr_dev(div5, "class", "topBar svelte-q13c4s");
    			add_location(div5, file$7, 64, 8, 2423);
    			attr_dev(div6, "class", "headerContainer svelte-q13c4s");
    			add_location(div6, file$7, 38, 1, 1172);
    			attr_dev(header, "class", "bagHeader svelte-q13c4s");
    			add_location(header, file$7, 37, 0, 1144);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, div6);
    			append_dev(div6, div1);
    			append_dev(div1, p0);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			append_dev(div0, p1);
    			if_block0.m(p1, null);
    			append_dev(div0, t2);
    			if_block1.m(div0, null);
    			append_dev(div6, t3);
    			append_dev(div6, div4);
    			append_dev(div4, img0);
    			append_dev(div4, t4);
    			append_dev(div4, div2);
    			append_dev(div2, img1);
    			append_dev(div4, t5);
    			append_dev(div4, div3);
    			append_dev(div3, img2);
    			append_dev(div3, t6);
    			append_dev(div3, img3);
    			append_dev(div6, t7);
    			append_dev(div6, div5);
    			if (if_block2) if_block2.m(div5, null);
    			append_dev(div5, t8);
    			append_dev(div5, a);
    			append_dev(div5, t10);
    			if (if_block3) if_block3.m(div5, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(p1, null);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div0, null);
    				}
    			}

    			if (/*loggedIn*/ ctx[2] == false) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_1$2(ctx);
    					if_block2.c();
    					if_block2.m(div5, t8);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*loggedIn*/ ctx[2]) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block$4(ctx);
    					if_block3.c();
    					if_block3.m(div5, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if_block0.d();
    			if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	let userName;
    	let userId;
    	let loggedIn;

    	isLoggedIn.subscribe(value => {
    		$$invalidate(2, loggedIn = value);
    	});

    	//isLoggedIn.subscribe(value => { loggedIn = value; });
    	user.subscribe(value => {
    		$$invalidate(0, userName = value);
    	});

    	userid.subscribe(value => {
    		$$invalidate(1, userId = value);
    	});

    	// Crear un despachador de eventos
    	const dispatch = createEventDispatcher();

    	// Función para manejar el clic del botón de iniciar sesión
    	function showLogin() {
    		dispatch('nav', { view: 'login' }); // Emitir un evento llamado "login"
    	}

    	function _logout() {
    		//Limpia todo para cerrar la sesion
    		localStorage.removeItem('jwt_token');

    		localStorage.removeItem('Test');
    		token.set(null);
    		user.set(null);
    		userid.set(null);
    		isLoggedIn.set(false);
    		window.location.reload();
    	} //dispatch('nav', { view: 'main' });

    	// Función para manejar el clic del botón inicio, para mostrar la vista principal
    	function main() {
    		dispatch('nav', { view: 'main' });
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		user,
    		userid,
    		token,
    		isLoggedIn,
    		userName,
    		userId,
    		loggedIn,
    		dispatch,
    		showLogin,
    		_logout,
    		main
    	});

    	$$self.$inject_state = $$props => {
    		if ('userName' in $$props) $$invalidate(0, userName = $$props.userName);
    		if ('userId' in $$props) $$invalidate(1, userId = $$props.userId);
    		if ('loggedIn' in $$props) $$invalidate(2, loggedIn = $$props.loggedIn);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [userName, userId, loggedIn, showLogin, _logout, main];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/components/Footer.svelte generated by Svelte v3.59.2 */

    const file$6 = "src/components/Footer.svelte";

    function create_fragment$6(ctx) {
    	let footer;
    	let div;
    	let p;
    	let t0;
    	let span;
    	let br0;
    	let t2;
    	let br1;
    	let t3;

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			div = element("div");
    			p = element("p");
    			t0 = text("Av. Los Ilustres, Los Chaguaramos, ");
    			span = element("span");
    			span.textContent = "Facultad de Ciencias, Universidad Central de Venezuela.";
    			br0 = element("br");
    			t2 = text("\n\t\tCaracas ZIP 1040, Apartado Postal 20513");
    			br1 = element("br");
    			t3 = text("\n\t\t(58212) 6051671/ 1665 / 2136 (FAX)");
    			attr_dev(span, "class", "ciens svelte-26g1yg");
    			add_location(span, file$6, 2, 40, 90);
    			add_location(br0, file$6, 2, 122, 172);
    			add_location(br1, file$6, 3, 41, 218);
    			add_location(p, file$6, 2, 2, 52);
    			attr_dev(div, "class", "footer svelte-26g1yg");
    			add_location(div, file$6, 1, 1, 28);
    			attr_dev(footer, "class", "bagFooter svelte-26g1yg");
    			add_location(footer, file$6, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, footer, anchor);
    			append_dev(footer, div);
    			append_dev(div, p);
    			append_dev(p, t0);
    			append_dev(p, span);
    			append_dev(p, br0);
    			append_dev(p, t2);
    			append_dev(p, br1);
    			append_dev(p, t3);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/components/Main.svelte generated by Svelte v3.59.2 */
    const file$5 = "src/components/Main.svelte";

    function create_fragment$5(ctx) {
    	let div3;
    	let div1;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let h1;
    	let t1;
    	let br;
    	let t2;
    	let t3;
    	let div2;
    	let button0;
    	let t5;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			h1 = element("h1");
    			t1 = text("Hola, mi nombre es Bagbot, soy el asistente virtual de la Biblioteca Alonso Gamero (BAG) ");
    			br = element("br");
    			t2 = text(" ¿Deseas iniciar sesión o ingresar como invitado?");
    			t3 = space();
    			div2 = element("div");
    			button0 = element("button");
    			button0.textContent = "Iniciar Sesión";
    			t5 = space();
    			button1 = element("button");
    			button1.textContent = "Entrar como invitado";
    			attr_dev(img, "class", "avatar svelte-1q2zto0");
    			if (!src_url_equal(img.src, img_src_value = /*bagbot_avatar*/ ctx[0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "avatar");
    			add_location(img, file$5, 17, 8, 485);
    			add_location(br, file$5, 19, 119, 694);
    			attr_dev(h1, "class", "title svelte-1q2zto0");
    			add_location(h1, file$5, 19, 12, 587);
    			attr_dev(div0, "class", "mainMessage");
    			add_location(div0, file$5, 18, 8, 549);
    			attr_dev(div1, "class", "container svelte-1q2zto0");
    			add_location(div1, file$5, 16, 4, 453);
    			attr_dev(button0, "class", "btn btn-primary");
    			add_location(button0, file$5, 24, 8, 818);
    			attr_dev(button1, "class", "btn btn-primary");
    			add_location(button1, file$5, 25, 8, 898);
    			attr_dev(div2, "class", "options");
    			add_location(div2, file$5, 23, 4, 788);
    			attr_dev(div3, "class", "mainBagbot svelte-1q2zto0");
    			add_location(div3, file$5, 15, 0, 424);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div1);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    			append_dev(h1, t1);
    			append_dev(h1, br);
    			append_dev(h1, t2);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, button0);
    			append_dev(div2, t5);
    			append_dev(div2, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*user*/ ctx[2], false, false, false, false),
    					listen_dev(button1, "click", /*guest*/ ctx[1], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Main', slots, []);
    	const dispatch = createEventDispatcher();
    	let bagbot_avatar = './assets/bagbot.png';

    	// Función para manejar el clic del botón Invitado
    	function guest() {
    		dispatch('nav', { view: 'guest' });
    	}

    	// Función para manejar el clic del botón iniciar sesion
    	function user() {
    		dispatch('nav', { view: 'login' });
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Main> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		bagbot_avatar,
    		guest,
    		user
    	});

    	$$self.$inject_state = $$props => {
    		if ('bagbot_avatar' in $$props) $$invalidate(0, bagbot_avatar = $$props.bagbot_avatar);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [bagbot_avatar, guest, user];
    }

    class Main extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Main",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/components/Onlymob.svelte generated by Svelte v3.59.2 */

    const file$4 = "src/components/Onlymob.svelte";

    function create_fragment$4(ctx) {
    	let div1;
    	let img;
    	let img_src_value;
    	let t0;
    	let div0;
    	let h1;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			img = element("img");
    			t0 = space();
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Hola, mi nombre es Bagbot, por favor ingresa desde un dispositivo de escritorio para acceder a mis funcionalidades.";
    			attr_dev(img, "class", "avatar svelte-m11ylk");
    			if (!src_url_equal(img.src, img_src_value = /*bagbot_avatar*/ ctx[0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "avatar");
    			add_location(img, file$4, 5, 4, 95);
    			attr_dev(h1, "class", "title svelte-m11ylk");
    			add_location(h1, file$4, 7, 8, 189);
    			attr_dev(div0, "class", "mainMessage");
    			add_location(div0, file$4, 6, 4, 155);
    			attr_dev(div1, "class", "container svelte-m11ylk");
    			add_location(div1, file$4, 4, 0, 67);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, img);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, h1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Onlymob', slots, []);
    	let bagbot_avatar = './assets/bagbot.png';
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Onlymob> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ bagbot_avatar });

    	$$self.$inject_state = $$props => {
    		if ('bagbot_avatar' in $$props) $$invalidate(0, bagbot_avatar = $$props.bagbot_avatar);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [bagbot_avatar];
    }

    class Onlymob extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Onlymob",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/components/Login.svelte generated by Svelte v3.59.2 */
    const file$3 = "src/components/Login.svelte";

    // (51:8) {:else}
    function create_else_block$2(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "inputLogin last svelte-fbd72a");
    			attr_dev(input, "name", "password");
    			attr_dev(input, "type", "password");
    			attr_dev(input, "placeholder", "Contraseña");
    			attr_dev(input, "autocomplete", "off");
    			input.required = true;
    			add_location(input, file$3, 51, 10, 1902);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*password*/ ctx[1]);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler_2*/ ctx[13]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*password*/ 2 && input.value !== /*password*/ ctx[1]) {
    				set_input_value(input, /*password*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(51:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (49:8) {#if showPwd}
    function create_if_block$3(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "inputLogin last svelte-fbd72a");
    			attr_dev(input, "name", "password");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Contraseña");
    			attr_dev(input, "autocomplete", "off");
    			input.required = true;
    			add_location(input, file$3, 49, 10, 1739);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*password*/ ctx[1]);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler_1*/ ctx[12]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*password*/ 2 && input.value !== /*password*/ ctx[1]) {
    				set_input_value(input, /*password*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(49:8) {#if showPwd}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div2;
    	let h2;
    	let t1;
    	let button0;
    	let t3;
    	let form;
    	let input;
    	let t4;
    	let div1;
    	let t5;
    	let div0;
    	let img;
    	let img_src_value;
    	let t6;
    	let p;
    	let t7;
    	let t8;
    	let button1;
    	let t10;
    	let button2;
    	let t12;
    	let button3;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*showPwd*/ ctx[3]) return create_if_block$3;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Inicio de Sesión";
    			t1 = space();
    			button0 = element("button");
    			button0.textContent = "X";
    			t3 = space();
    			form = element("form");
    			input = element("input");
    			t4 = space();
    			div1 = element("div");
    			if_block.c();
    			t5 = space();
    			div0 = element("div");
    			img = element("img");
    			t6 = space();
    			p = element("p");
    			t7 = text(/*errMessage*/ ctx[2]);
    			t8 = space();
    			button1 = element("button");
    			button1.textContent = "Iniciar Sesión";
    			t10 = space();
    			button2 = element("button");
    			button2.textContent = "¿Olvidó su Contraseña?";
    			t12 = space();
    			button3 = element("button");
    			button3.textContent = "¿No está registrado? Regístrese";
    			attr_dev(h2, "class", "title");
    			add_location(h2, file$3, 43, 4, 1386);
    			attr_dev(button0, "class", "btn btn-primary close svelte-fbd72a");
    			add_location(button0, file$3, 44, 4, 1430);
    			attr_dev(input, "class", "inputLogin svelte-fbd72a");
    			attr_dev(input, "name", "email");
    			attr_dev(input, "type", "email");
    			attr_dev(input, "placeholder", "Correo");
    			input.required = true;
    			add_location(input, file$3, 46, 6, 1576);
    			attr_dev(img, "class", "avatar");

    			if (!src_url_equal(img.src, img_src_value = /*showPwd*/ ctx[3]
    			? /*close_eye*/ ctx[5]
    			: /*open_eye*/ ctx[4])) attr_dev(img, "src", img_src_value);

    			attr_dev(img, "alt", "avatar");
    			add_location(img, file$3, 55, 10, 2188);
    			attr_dev(div0, "class", "showPass svelte-fbd72a");
    			add_location(div0, file$3, 54, 8, 2130);
    			attr_dev(div1, "class", "pwdSect svelte-fbd72a");
    			add_location(div1, file$3, 47, 6, 1685);
    			attr_dev(p, "class", "errMessage svelte-fbd72a");
    			add_location(p, file$3, 59, 6, 2297);
    			attr_dev(button1, "class", "btn btn-primary login");
    			attr_dev(button1, "type", "submit");
    			add_location(button1, file$3, 60, 6, 2342);
    			attr_dev(form, "class", "form svelte-fbd72a");
    			add_location(form, file$3, 45, 4, 1511);
    			attr_dev(button2, "class", "registerButton one svelte-fbd72a");
    			add_location(button2, file$3, 62, 4, 2434);
    			attr_dev(button3, "class", "registerButton two svelte-fbd72a");
    			add_location(button3, file$3, 63, 4, 2527);
    			attr_dev(div2, "class", "containerForm svelte-fbd72a");
    			add_location(div2, file$3, 42, 2, 1354);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, h2);
    			append_dev(div2, t1);
    			append_dev(div2, button0);
    			append_dev(div2, t3);
    			append_dev(div2, form);
    			append_dev(form, input);
    			set_input_value(input, /*email*/ ctx[0]);
    			append_dev(form, t4);
    			append_dev(form, div1);
    			if_block.m(div1, null);
    			append_dev(div1, t5);
    			append_dev(div1, div0);
    			append_dev(div0, img);
    			append_dev(form, t6);
    			append_dev(form, p);
    			append_dev(p, t7);
    			append_dev(form, t8);
    			append_dev(form, button1);
    			append_dev(div2, t10);
    			append_dev(div2, button2);
    			append_dev(div2, t12);
    			append_dev(div2, button3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*handleCloseClick*/ ctx[6], false, false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[11]),
    					listen_dev(div0, "click", /*toglePassword*/ ctx[7], false, false, false, false),
    					listen_dev(form, "submit", prevent_default(/*clickButton*/ ctx[8]), false, true, false, false),
    					listen_dev(button2, "click", /*forgotPWD*/ ctx[10], false, false, false, false),
    					listen_dev(button3, "click", /*registerOption*/ ctx[9], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*email*/ 1 && input.value !== /*email*/ ctx[0]) {
    				set_input_value(input, /*email*/ ctx[0]);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, t5);
    				}
    			}

    			if (dirty & /*showPwd*/ 8 && !src_url_equal(img.src, img_src_value = /*showPwd*/ ctx[3]
    			? /*close_eye*/ ctx[5]
    			: /*open_eye*/ ctx[4])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*errMessage*/ 4) set_data_dev(t7, /*errMessage*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Login', slots, []);
    	let open_eye = './assets/eyeOpen.png';
    	let close_eye = './assets/eyeClose.png';
    	let email = '';
    	let password = '';
    	let errMessage = '';
    	let showPwd = false; //Contraseña oculta
    	const dispatch = createEventDispatcher();

    	// Función para manejar el clic del botón de close login
    	function handleCloseClick() {
    		dispatch('closeLogin'); // Emitir un evento llamado "closeLogin"
    	}

    	function toglePassword() {
    		$$invalidate(3, showPwd = !showPwd); // alterna true/false
    	}

    	async function clickButton() {
    		const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    		if (!regex.test(email)) {
    			// Si el email no es correcto
    			$$invalidate(2, errMessage = 'El correo no es válido');

    			setTimeout(
    				() => {
    					$$invalidate(2, errMessage = '');
    				},
    				8000
    			);

    			return;
    		}

    		// Llama a login con los datos registrados
    		const loginMsg = await login(email, password); //funcion en store.js

    		$$invalidate(2, errMessage = loginMsg);

    		setTimeout(
    			() => {
    				$$invalidate(2, errMessage = '');
    			},
    			8000
    		);
    	}

    	function registerOption() {
    		dispatch('nav', { view: 'register' });
    	}

    	function forgotPWD() {
    		dispatch('nav', { view: 'forgot' });
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Login> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		email = this.value;
    		$$invalidate(0, email);
    	}

    	function input_input_handler_1() {
    		password = this.value;
    		$$invalidate(1, password);
    	}

    	function input_input_handler_2() {
    		password = this.value;
    		$$invalidate(1, password);
    	}

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		login,
    		open_eye,
    		close_eye,
    		email,
    		password,
    		errMessage,
    		showPwd,
    		dispatch,
    		handleCloseClick,
    		toglePassword,
    		clickButton,
    		registerOption,
    		forgotPWD
    	});

    	$$self.$inject_state = $$props => {
    		if ('open_eye' in $$props) $$invalidate(4, open_eye = $$props.open_eye);
    		if ('close_eye' in $$props) $$invalidate(5, close_eye = $$props.close_eye);
    		if ('email' in $$props) $$invalidate(0, email = $$props.email);
    		if ('password' in $$props) $$invalidate(1, password = $$props.password);
    		if ('errMessage' in $$props) $$invalidate(2, errMessage = $$props.errMessage);
    		if ('showPwd' in $$props) $$invalidate(3, showPwd = $$props.showPwd);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		email,
    		password,
    		errMessage,
    		showPwd,
    		open_eye,
    		close_eye,
    		handleCloseClick,
    		toglePassword,
    		clickButton,
    		registerOption,
    		forgotPWD,
    		input_input_handler,
    		input_input_handler_1,
    		input_input_handler_2
    	];
    }

    class Login extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Login",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/components/Register.svelte generated by Svelte v3.59.2 */
    const file$2 = "src/components/Register.svelte";

    // (81:31) {#if typePerson != ""}
    function create_if_block_2$1(ctx) {
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("- ");
    			t1 = text(/*typePerson*/ ctx[0]);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*typePerson*/ 1) set_data_dev(t1, /*typePerson*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(81:31) {#if typePerson != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (93:8) {:else}
    function create_else_block$1(ctx) {
    	let button0;
    	let t1;
    	let input0;
    	let t2;
    	let div;
    	let select0;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let t7;
    	let input1;
    	let t8;
    	let select1;
    	let option4;
    	let option5;
    	let option6;
    	let t12;
    	let t13;
    	let input2;
    	let t14;
    	let input3;
    	let t15;
    	let input4;
    	let t16;
    	let p0;
    	let t17;
    	let t18;
    	let p1;
    	let t19;
    	let t20;
    	let button1;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*typePerson*/ ctx[0] === "Empleado") return create_if_block_1$1;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			button0.textContent = "X";
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div = element("div");
    			select0 = element("select");
    			option0 = element("option");
    			option0.textContent = "Seleccione su sexo";
    			option1 = element("option");
    			option1.textContent = "Masculino";
    			option2 = element("option");
    			option2.textContent = "Femenino";
    			option3 = element("option");
    			option3.textContent = "Otro";
    			t7 = space();
    			input1 = element("input");
    			t8 = space();
    			select1 = element("select");
    			option4 = element("option");
    			option4.textContent = "Biblioteca:";
    			option5 = element("option");
    			option5.textContent = "Biblioteca Alonso Gamero - BAG";
    			option6 = element("option");
    			option6.textContent = "Otra";
    			t12 = space();
    			if_block.c();
    			t13 = space();
    			input2 = element("input");
    			t14 = space();
    			input3 = element("input");
    			t15 = space();
    			input4 = element("input");
    			t16 = space();
    			p0 = element("p");
    			t17 = text(/*errMessage*/ ctx[10]);
    			t18 = space();
    			p1 = element("p");
    			t19 = text(/*okMessage*/ ctx[11]);
    			t20 = space();
    			button1 = element("button");
    			button1.textContent = "Registrar";
    			attr_dev(button0, "class", "btn btn-primary close svelte-1t0qk9w");
    			add_location(button0, file$2, 93, 12, 3192);
    			attr_dev(input0, "class", "inputRegister svelte-1t0qk9w");
    			attr_dev(input0, "name", "fullname");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Nombres y Apellidos");
    			input0.required = true;
    			add_location(input0, file$2, 94, 12, 3276);
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.disabled = true;
    			option0.selected = true;
    			add_location(option0, file$2, 97, 20, 3537);
    			option1.__value = "M";
    			option1.value = option1.__value;
    			add_location(option1, file$2, 98, 20, 3620);
    			option2.__value = "F";
    			option2.value = option2.__value;
    			add_location(option2, file$2, 99, 20, 3677);
    			option3.__value = "O";
    			option3.value = option3.__value;
    			add_location(option3, file$2, 100, 20, 3733);
    			attr_dev(select0, "id", "sexo");
    			attr_dev(select0, "class", "options data svelte-1t0qk9w");
    			select0.required = true;
    			if (/*sex*/ ctx[2] === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[17].call(select0));
    			add_location(select0, file$2, 96, 16, 3451);
    			attr_dev(input1, "class", "inputRegister data svelte-1t0qk9w");
    			attr_dev(input1, "name", "idnumber");
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "Cédula - Ej:V12345678");
    			input1.required = true;
    			add_location(input1, file$2, 102, 16, 3807);
    			attr_dev(div, "class", "dataSect svelte-1t0qk9w");
    			add_location(div, file$2, 95, 12, 3412);
    			option4.__value = "";
    			option4.value = option4.__value;
    			option4.disabled = true;
    			option4.selected = true;
    			add_location(option4, file$2, 105, 16, 4053);
    			option5.__value = "BAG";
    			option5.value = option5.__value;
    			add_location(option5, file$2, 106, 16, 4125);
    			option6.__value = "OTRA";
    			option6.value = option6.__value;
    			add_location(option6, file$2, 107, 16, 4201);
    			attr_dev(select1, "id", "library");
    			attr_dev(select1, "class", "options svelte-1t0qk9w");
    			select1.required = true;
    			if (/*library*/ ctx[4] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[19].call(select1));
    			add_location(select1, file$2, 104, 12, 3969);
    			attr_dev(input2, "class", "inputRegister svelte-1t0qk9w");
    			attr_dev(input2, "name", "email");
    			attr_dev(input2, "type", "email");
    			attr_dev(input2, "placeholder", "Correo");
    			input2.required = true;
    			add_location(input2, file$2, 124, 12, 5218);
    			attr_dev(input3, "class", "inputRegister svelte-1t0qk9w");
    			attr_dev(input3, "name", "password");
    			attr_dev(input3, "type", "password");
    			attr_dev(input3, "placeholder", "Contraseña");
    			attr_dev(input3, "autocomplete", "off");
    			input3.required = true;
    			add_location(input3, file$2, 125, 12, 5336);
    			attr_dev(input4, "class", "inputRegister svelte-1t0qk9w");
    			attr_dev(input4, "name", "validatePassword");
    			attr_dev(input4, "type", "password");
    			attr_dev(input4, "placeholder", "Validar Contraseña");
    			attr_dev(input4, "autocomplete", "off");
    			input4.required = true;
    			add_location(input4, file$2, 126, 12, 5486);
    			attr_dev(p0, "class", "errMessage svelte-1t0qk9w");
    			add_location(p0, file$2, 127, 12, 5660);
    			attr_dev(p1, "class", "okMessage svelte-1t0qk9w");
    			add_location(p1, file$2, 128, 12, 5711);
    			attr_dev(button1, "class", "btn btn-primary");
    			attr_dev(button1, "type", "submit");
    			add_location(button1, file$2, 129, 12, 5760);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, input0, anchor);
    			set_input_value(input0, /*fullname*/ ctx[1]);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, select0);
    			append_dev(select0, option0);
    			append_dev(select0, option1);
    			append_dev(select0, option2);
    			append_dev(select0, option3);
    			select_option(select0, /*sex*/ ctx[2], true);
    			append_dev(div, t7);
    			append_dev(div, input1);
    			set_input_value(input1, /*idnumber*/ ctx[3]);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, select1, anchor);
    			append_dev(select1, option4);
    			append_dev(select1, option5);
    			append_dev(select1, option6);
    			select_option(select1, /*library*/ ctx[4], true);
    			insert_dev(target, t12, anchor);
    			if_block.m(target, anchor);
    			insert_dev(target, t13, anchor);
    			insert_dev(target, input2, anchor);
    			set_input_value(input2, /*email*/ ctx[7]);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, input3, anchor);
    			set_input_value(input3, /*password*/ ctx[8]);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, input4, anchor);
    			set_input_value(input4, /*validatePassword*/ ctx[9]);
    			insert_dev(target, t16, anchor);
    			insert_dev(target, p0, anchor);
    			append_dev(p0, t17);
    			insert_dev(target, t18, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t19);
    			insert_dev(target, t20, anchor);
    			insert_dev(target, button1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*resetPerson*/ ctx[13], false, false, false, false),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[16]),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[17]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[18]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[19]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[22]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[23]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[24])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*fullname*/ 2 && input0.value !== /*fullname*/ ctx[1]) {
    				set_input_value(input0, /*fullname*/ ctx[1]);
    			}

    			if (dirty & /*sex*/ 4) {
    				select_option(select0, /*sex*/ ctx[2]);
    			}

    			if (dirty & /*idnumber*/ 8 && input1.value !== /*idnumber*/ ctx[3]) {
    				set_input_value(input1, /*idnumber*/ ctx[3]);
    			}

    			if (dirty & /*library*/ 16) {
    				select_option(select1, /*library*/ ctx[4]);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(t13.parentNode, t13);
    				}
    			}

    			if (dirty & /*email*/ 128 && input2.value !== /*email*/ ctx[7]) {
    				set_input_value(input2, /*email*/ ctx[7]);
    			}

    			if (dirty & /*password*/ 256 && input3.value !== /*password*/ ctx[8]) {
    				set_input_value(input3, /*password*/ ctx[8]);
    			}

    			if (dirty & /*validatePassword*/ 512 && input4.value !== /*validatePassword*/ ctx[9]) {
    				set_input_value(input4, /*validatePassword*/ ctx[9]);
    			}

    			if (dirty & /*errMessage*/ 1024) set_data_dev(t17, /*errMessage*/ ctx[10]);
    			if (dirty & /*okMessage*/ 2048) set_data_dev(t19, /*okMessage*/ ctx[11]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(input0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(select1);
    			if (detaching) detach_dev(t12);
    			if_block.d(detaching);
    			if (detaching) detach_dev(t13);
    			if (detaching) detach_dev(input2);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(input3);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(input4);
    			if (detaching) detach_dev(t16);
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t18);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t20);
    			if (detaching) detach_dev(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(93:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (83:8) {#if typePerson === ""}
    function create_if_block$2(ctx) {
    	let button;
    	let t1;
    	let p;
    	let t3;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "X";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Indique el tipo de usuario del sistema:";
    			t3 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Seleccione el tipo de Usuario";
    			option1 = element("option");
    			option1.textContent = "Profesor";
    			option2 = element("option");
    			option2.textContent = "Estudiante";
    			option3 = element("option");
    			option3.textContent = "Empleado";
    			attr_dev(button, "class", "btn btn-primary close svelte-1t0qk9w");
    			add_location(button, file$2, 84, 12, 2644);
    			attr_dev(p, "class", "typeMessage");
    			add_location(p, file$2, 85, 12, 2733);
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.disabled = true;
    			option0.selected = true;
    			add_location(option0, file$2, 87, 16, 2887);
    			option1.__value = "Profesor";
    			option1.value = option1.__value;
    			add_location(option1, file$2, 88, 16, 2977);
    			option2.__value = "Estudiante";
    			option2.value = option2.__value;
    			add_location(option2, file$2, 89, 16, 3036);
    			option3.__value = "Empleado";
    			option3.value = option3.__value;
    			add_location(option3, file$2, 90, 16, 3099);
    			attr_dev(select, "id", "type");
    			attr_dev(select, "class", "options svelte-1t0qk9w");
    			if (/*typePerson*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[15].call(select));
    			add_location(select, file$2, 86, 12, 2812);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, select, anchor);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			append_dev(select, option3);
    			select_option(select, /*typePerson*/ ctx[0], true);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*handleCloseClick*/ ctx[12], false, false, false, false),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[15])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*typePerson*/ 1) {
    				select_option(select, /*typePerson*/ ctx[0]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(select);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(83:8) {#if typePerson === \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (112:12) {:else}
    function create_else_block_1(ctx) {
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let option4;
    	let option5;
    	let option6;
    	let option7;
    	let option8;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Seleccione su Escuela/Dependencia";
    			option1 = element("option");
    			option1.textContent = "COMPUTACIÓN";
    			option2 = element("option");
    			option2.textContent = "MATEMÁTICA";
    			option3 = element("option");
    			option3.textContent = "QUÍMICA";
    			option4 = element("option");
    			option4.textContent = "GEOQUÍMICA";
    			option5 = element("option");
    			option5.textContent = "FÍSICA";
    			option6 = element("option");
    			option6.textContent = "BIOLOGÍA";
    			option7 = element("option");
    			option7.textContent = "ADMINISTRATIVO";
    			option8 = element("option");
    			option8.textContent = "OTRA";
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.disabled = true;
    			option0.selected = true;
    			add_location(option0, file$2, 113, 20, 4568);
    			option1.__value = "COMPUTACIÓN";
    			option1.value = option1.__value;
    			add_location(option1, file$2, 114, 20, 4666);
    			option2.__value = "MATEMÁTICA";
    			option2.value = option2.__value;
    			add_location(option2, file$2, 115, 20, 4735);
    			option3.__value = "QUÍMICA";
    			option3.value = option3.__value;
    			add_location(option3, file$2, 116, 20, 4802);
    			option4.__value = "GEOQUÍMICA";
    			option4.value = option4.__value;
    			add_location(option4, file$2, 117, 20, 4863);
    			option5.__value = "FÍSICA";
    			option5.value = option5.__value;
    			add_location(option5, file$2, 118, 20, 4930);
    			option6.__value = "BIOLOGÍA";
    			option6.value = option6.__value;
    			add_location(option6, file$2, 119, 20, 4989);
    			option7.__value = "ADMINISTRATIVO";
    			option7.value = option7.__value;
    			add_location(option7, file$2, 120, 20, 5052);
    			option8.__value = "OTRA";
    			option8.value = option8.__value;
    			add_location(option8, file$2, 121, 20, 5127);
    			attr_dev(select, "id", "dependence");
    			attr_dev(select, "class", "options svelte-1t0qk9w");
    			select.required = true;
    			if (/*dependence*/ ctx[5] === void 0) add_render_callback(() => /*select_change_handler_1*/ ctx[21].call(select));
    			add_location(select, file$2, 112, 16, 4474);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, select, anchor);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			append_dev(select, option3);
    			append_dev(select, option4);
    			append_dev(select, option5);
    			append_dev(select, option6);
    			append_dev(select, option7);
    			append_dev(select, option8);
    			select_option(select, /*dependence*/ ctx[5], true);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*select_change_handler_1*/ ctx[21]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*dependence*/ 32) {
    				select_option(select, /*dependence*/ ctx[5]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(select);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(112:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (110:12) {#if typePerson === "Empleado"}
    function create_if_block_1$1(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "inputRegister svelte-1t0qk9w");
    			attr_dev(input, "name", "position");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Cargo que Ocupa");
    			input.required = true;
    			add_location(input, file$2, 110, 16, 4318);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*position*/ ctx[6]);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler*/ ctx[20]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*position*/ 64 && input.value !== /*position*/ ctx[6]) {
    				set_input_value(input, /*position*/ ctx[6]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(110:12) {#if typePerson === \\\"Empleado\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let h2;
    	let t0;
    	let t1;
    	let form;
    	let mounted;
    	let dispose;
    	let if_block0 = /*typePerson*/ ctx[0] != "" && create_if_block_2$1(ctx);

    	function select_block_type(ctx, dirty) {
    		if (/*typePerson*/ ctx[0] === "") return create_if_block$2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block1 = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			t0 = text("Registro ");
    			if (if_block0) if_block0.c();
    			t1 = space();
    			form = element("form");
    			if_block1.c();
    			attr_dev(h2, "class", "title");
    			add_location(h2, file$2, 80, 4, 2407);
    			attr_dev(form, "class", "form svelte-1t0qk9w");
    			add_location(form, file$2, 81, 4, 2485);
    			attr_dev(div, "class", "containerForm svelte-1t0qk9w");
    			add_location(div, file$2, 79, 0, 2375);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(h2, t0);
    			if (if_block0) if_block0.m(h2, null);
    			append_dev(div, t1);
    			append_dev(div, form);
    			if_block1.m(form, null);

    			if (!mounted) {
    				dispose = listen_dev(form, "submit", prevent_default(/*clickButton*/ ctx[14]), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*typePerson*/ ctx[0] != "") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2$1(ctx);
    					if_block0.c();
    					if_block0.m(h2, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(form, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Register', slots, []);
    	let typePerson = ""; // Guarda si es "Estudiante", "Profesor" o "Empleado"
    	let fullname = '';
    	let sex = '';
    	let idnumber = ''; //cedula
    	let library = ''; //Cargo
    	let dependence = ''; //escuela o administrativo
    	let position = ''; //Cargo
    	let email = '';
    	let password = '';
    	let validatePassword = '';
    	let errMessage = '';
    	let okMessage = '';
    	const dispatch = createEventDispatcher();

    	// Función para manejar el clic del botón de close Registro
    	function handleCloseClick() {
    		dispatch('closeRegister'); // Emitir un evento llamado "closeRegister" y vualve a la vista login
    	}

    	function resetPerson() {
    		$$invalidate(0, typePerson = ''); // Cambia la variable a vacio para volver a la vista de seleccion de tipo de persona
    	}

    	function clickButton() {
    		const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    		if (!regex.test(email)) {
    			// Si el email no es correcto
    			$$invalidate(10, errMessage = 'El correo no es válido');

    			setTimeout(
    				() => {
    					$$invalidate(10, errMessage = '');
    				},
    				8000
    			);

    			return;
    		}

    		if (password != validatePassword) {
    			// Si el email no es correcto
    			$$invalidate(10, errMessage = 'Las contraseñas no coinciden');

    			setTimeout(
    				() => {
    					$$invalidate(10, errMessage = '');
    				},
    				8000
    			);

    			return;
    		}

    		register();
    	}

    	// Función para manejar el registro
    	const register = async () => {
    		const response = await fetch('http://127.0.0.1:5000/register', {
    			method: 'POST',
    			headers: { 'Content-Type': 'application/json' },
    			body: JSON.stringify({
    				fullname,
    				email,
    				sex,
    				idnumber,
    				password,
    				library,
    				typePerson,
    				dependence,
    				position
    			})
    		});

    		const data = await response.json();

    		if (response.ok) {
    			$$invalidate(11, okMessage = `Usuario ${data.id} registrado con éxito`);

    			// Llama a login con los datos registrados
    			setTimeout(
    				async () => {
    					await login(email, password);
    				},
    				3000
    			);
    		} else {
    			$$invalidate(10, errMessage = data.msg);
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Register> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		typePerson = select_value(this);
    		$$invalidate(0, typePerson);
    	}

    	function input0_input_handler() {
    		fullname = this.value;
    		$$invalidate(1, fullname);
    	}

    	function select0_change_handler() {
    		sex = select_value(this);
    		$$invalidate(2, sex);
    	}

    	function input1_input_handler() {
    		idnumber = this.value;
    		$$invalidate(3, idnumber);
    	}

    	function select1_change_handler() {
    		library = select_value(this);
    		$$invalidate(4, library);
    	}

    	function input_input_handler() {
    		position = this.value;
    		$$invalidate(6, position);
    	}

    	function select_change_handler_1() {
    		dependence = select_value(this);
    		$$invalidate(5, dependence);
    	}

    	function input2_input_handler() {
    		email = this.value;
    		$$invalidate(7, email);
    	}

    	function input3_input_handler() {
    		password = this.value;
    		$$invalidate(8, password);
    	}

    	function input4_input_handler() {
    		validatePassword = this.value;
    		$$invalidate(9, validatePassword);
    	}

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		login,
    		typePerson,
    		fullname,
    		sex,
    		idnumber,
    		library,
    		dependence,
    		position,
    		email,
    		password,
    		validatePassword,
    		errMessage,
    		okMessage,
    		dispatch,
    		handleCloseClick,
    		resetPerson,
    		clickButton,
    		register
    	});

    	$$self.$inject_state = $$props => {
    		if ('typePerson' in $$props) $$invalidate(0, typePerson = $$props.typePerson);
    		if ('fullname' in $$props) $$invalidate(1, fullname = $$props.fullname);
    		if ('sex' in $$props) $$invalidate(2, sex = $$props.sex);
    		if ('idnumber' in $$props) $$invalidate(3, idnumber = $$props.idnumber);
    		if ('library' in $$props) $$invalidate(4, library = $$props.library);
    		if ('dependence' in $$props) $$invalidate(5, dependence = $$props.dependence);
    		if ('position' in $$props) $$invalidate(6, position = $$props.position);
    		if ('email' in $$props) $$invalidate(7, email = $$props.email);
    		if ('password' in $$props) $$invalidate(8, password = $$props.password);
    		if ('validatePassword' in $$props) $$invalidate(9, validatePassword = $$props.validatePassword);
    		if ('errMessage' in $$props) $$invalidate(10, errMessage = $$props.errMessage);
    		if ('okMessage' in $$props) $$invalidate(11, okMessage = $$props.okMessage);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		typePerson,
    		fullname,
    		sex,
    		idnumber,
    		library,
    		dependence,
    		position,
    		email,
    		password,
    		validatePassword,
    		errMessage,
    		okMessage,
    		handleCloseClick,
    		resetPerson,
    		clickButton,
    		select_change_handler,
    		input0_input_handler,
    		select0_change_handler,
    		input1_input_handler,
    		select1_change_handler,
    		input_input_handler,
    		select_change_handler_1,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler
    	];
    }

    class Register extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Register",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/components/Forgot.svelte generated by Svelte v3.59.2 */
    const file$1 = "src/components/Forgot.svelte";

    // (87:8) {:else}
    function create_else_block(ctx) {
    	let button0;
    	let t1;
    	let div;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let t6;
    	let input0;
    	let t7;
    	let input1;
    	let t8;
    	let input2;
    	let t9;
    	let input3;
    	let t10;
    	let p0;
    	let t11;
    	let t12;
    	let p1;
    	let t13;
    	let t14;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button0 = element("button");
    			button0.textContent = "X";
    			t1 = space();
    			div = element("div");
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Seleccione su sexo";
    			option1 = element("option");
    			option1.textContent = "Masculino";
    			option2 = element("option");
    			option2.textContent = "Femenino";
    			option3 = element("option");
    			option3.textContent = "Otro";
    			t6 = space();
    			input0 = element("input");
    			t7 = space();
    			input1 = element("input");
    			t8 = space();
    			input2 = element("input");
    			t9 = space();
    			input3 = element("input");
    			t10 = space();
    			p0 = element("p");
    			t11 = text(/*errMessage*/ ctx[6]);
    			t12 = space();
    			p1 = element("p");
    			t13 = text(/*okMessage*/ ctx[7]);
    			t14 = space();
    			button1 = element("button");
    			button1.textContent = "Cambiar Contraseña";
    			attr_dev(button0, "class", "btn btn-primary close svelte-1t0qk9w");
    			add_location(button0, file$1, 87, 12, 3000);
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.disabled = true;
    			option0.selected = true;
    			add_location(option0, file$1, 90, 20, 3209);
    			option1.__value = "M";
    			option1.value = option1.__value;
    			add_location(option1, file$1, 91, 20, 3292);
    			option2.__value = "F";
    			option2.value = option2.__value;
    			add_location(option2, file$1, 92, 20, 3349);
    			option3.__value = "O";
    			option3.value = option3.__value;
    			add_location(option3, file$1, 93, 20, 3405);
    			attr_dev(select, "id", "sexo");
    			attr_dev(select, "class", "options data svelte-1t0qk9w");
    			select.required = true;
    			if (/*sex*/ ctx[1] === void 0) add_render_callback(() => /*select_change_handler_1*/ ctx[12].call(select));
    			add_location(select, file$1, 89, 16, 3123);
    			attr_dev(input0, "class", "inputRegister data svelte-1t0qk9w");
    			attr_dev(input0, "name", "idnumber");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Cédula - Ej:V12345678");
    			input0.required = true;
    			add_location(input0, file$1, 95, 16, 3479);
    			attr_dev(div, "class", "dataSect svelte-1t0qk9w");
    			add_location(div, file$1, 88, 12, 3084);
    			attr_dev(input1, "class", "inputRegister svelte-1t0qk9w");
    			attr_dev(input1, "name", "email");
    			attr_dev(input1, "type", "email");
    			attr_dev(input1, "placeholder", "Correo");
    			input1.required = true;
    			add_location(input1, file$1, 97, 12, 3641);
    			attr_dev(input2, "class", "inputRegister svelte-1t0qk9w");
    			attr_dev(input2, "name", "password");
    			attr_dev(input2, "type", "password");
    			attr_dev(input2, "placeholder", "Nueva Contraseña");
    			attr_dev(input2, "autocomplete", "off");
    			input2.required = true;
    			add_location(input2, file$1, 98, 12, 3759);
    			attr_dev(input3, "class", "inputRegister svelte-1t0qk9w");
    			attr_dev(input3, "name", "validatePassword");
    			attr_dev(input3, "type", "password");
    			attr_dev(input3, "placeholder", "Validar Nueva Contraseña");
    			attr_dev(input3, "autocomplete", "off");
    			input3.required = true;
    			add_location(input3, file$1, 99, 12, 3915);
    			attr_dev(p0, "class", "errMessage svelte-1t0qk9w");
    			add_location(p0, file$1, 100, 12, 4095);
    			attr_dev(p1, "class", "okMessage svelte-1t0qk9w");
    			add_location(p1, file$1, 101, 12, 4146);
    			attr_dev(button1, "class", "btn btn-primary");
    			attr_dev(button1, "type", "submit");
    			add_location(button1, file$1, 102, 12, 4195);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, select);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			append_dev(select, option3);
    			select_option(select, /*sex*/ ctx[1], true);
    			append_dev(div, t6);
    			append_dev(div, input0);
    			set_input_value(input0, /*idnumber*/ ctx[2]);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, input1, anchor);
    			set_input_value(input1, /*email*/ ctx[3]);
    			insert_dev(target, t8, anchor);
    			insert_dev(target, input2, anchor);
    			set_input_value(input2, /*password*/ ctx[4]);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, input3, anchor);
    			set_input_value(input3, /*validatePassword*/ ctx[5]);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, p0, anchor);
    			append_dev(p0, t11);
    			insert_dev(target, t12, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t13);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, button1, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*resetPerson*/ ctx[9], false, false, false, false),
    					listen_dev(select, "change", /*select_change_handler_1*/ ctx[12]),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[13]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[14]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[15]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[16])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sex*/ 2) {
    				select_option(select, /*sex*/ ctx[1]);
    			}

    			if (dirty & /*idnumber*/ 4 && input0.value !== /*idnumber*/ ctx[2]) {
    				set_input_value(input0, /*idnumber*/ ctx[2]);
    			}

    			if (dirty & /*email*/ 8 && input1.value !== /*email*/ ctx[3]) {
    				set_input_value(input1, /*email*/ ctx[3]);
    			}

    			if (dirty & /*password*/ 16 && input2.value !== /*password*/ ctx[4]) {
    				set_input_value(input2, /*password*/ ctx[4]);
    			}

    			if (dirty & /*validatePassword*/ 32 && input3.value !== /*validatePassword*/ ctx[5]) {
    				set_input_value(input3, /*validatePassword*/ ctx[5]);
    			}

    			if (dirty & /*errMessage*/ 64) set_data_dev(t11, /*errMessage*/ ctx[6]);
    			if (dirty & /*okMessage*/ 128) set_data_dev(t13, /*okMessage*/ ctx[7]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(input1);
    			if (detaching) detach_dev(t8);
    			if (detaching) detach_dev(input2);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(input3);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t12);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(87:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (77:8) {#if typePerson === ""}
    function create_if_block$1(ctx) {
    	let button;
    	let t1;
    	let p;
    	let t3;
    	let select;
    	let option0;
    	let option1;
    	let option2;
    	let option3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "X";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Indique el tipo de usuario del sistema:";
    			t3 = space();
    			select = element("select");
    			option0 = element("option");
    			option0.textContent = "Seleccione el tipo de Usuario";
    			option1 = element("option");
    			option1.textContent = "Profesor";
    			option2 = element("option");
    			option2.textContent = "Estudiante";
    			option3 = element("option");
    			option3.textContent = "Empleado";
    			attr_dev(button, "class", "btn btn-primary close svelte-1t0qk9w");
    			add_location(button, file$1, 78, 12, 2452);
    			attr_dev(p, "class", "typeMessage");
    			add_location(p, file$1, 79, 12, 2541);
    			option0.__value = "";
    			option0.value = option0.__value;
    			option0.disabled = true;
    			option0.selected = true;
    			add_location(option0, file$1, 81, 16, 2695);
    			option1.__value = "Profesor";
    			option1.value = option1.__value;
    			add_location(option1, file$1, 82, 16, 2785);
    			option2.__value = "Estudiante";
    			option2.value = option2.__value;
    			add_location(option2, file$1, 83, 16, 2844);
    			option3.__value = "Empleado";
    			option3.value = option3.__value;
    			add_location(option3, file$1, 84, 16, 2907);
    			attr_dev(select, "id", "type");
    			attr_dev(select, "class", "options svelte-1t0qk9w");
    			if (/*typePerson*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[11].call(select));
    			add_location(select, file$1, 80, 12, 2620);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, select, anchor);
    			append_dev(select, option0);
    			append_dev(select, option1);
    			append_dev(select, option2);
    			append_dev(select, option3);
    			select_option(select, /*typePerson*/ ctx[0], true);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*handleCloseClick*/ ctx[8], false, false, false, false),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*typePerson*/ 1) {
    				select_option(select, /*typePerson*/ ctx[0]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(select);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(77:8) {#if typePerson === \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let h2;
    	let t1;
    	let form;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*typePerson*/ ctx[0] === "") return create_if_block$1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Introduzca sus datos";
    			t1 = space();
    			form = element("form");
    			if_block.c();
    			attr_dev(h2, "class", "title");
    			add_location(h2, file$1, 74, 4, 2245);
    			attr_dev(form, "class", "form svelte-1t0qk9w");
    			add_location(form, file$1, 75, 4, 2293);
    			attr_dev(div, "class", "containerForm svelte-1t0qk9w");
    			add_location(div, file$1, 73, 0, 2213);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, form);
    			if_block.m(form, null);

    			if (!mounted) {
    				dispose = listen_dev(form, "submit", prevent_default(/*clickButton*/ ctx[10]), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(form, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Forgot', slots, []);
    	let typePerson = ""; // Guarda si es "Estudiante", "Profesor" o "Empleado"
    	let sex = '';
    	let idnumber = ''; //cedula
    	let email = '';
    	let password = '';
    	let validatePassword = '';
    	let errMessage = '';
    	let okMessage = '';
    	const dispatch = createEventDispatcher();

    	// Función para manejar el clic del botón de close Registro
    	function handleCloseClick() {
    		dispatch('closeRegister'); // Emitir un evento llamado "closeRegister" y vualve a la vista login
    	}

    	function resetPerson() {
    		$$invalidate(0, typePerson = ''); // Cambia la variable a vacio para volver a la vista de seleccion de tipo de persona
    	}

    	function clickButton() {
    		const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    		if (!regex.test(email)) {
    			// Si el email no es correcto
    			$$invalidate(6, errMessage = 'El correo no es válido');

    			setTimeout(
    				() => {
    					$$invalidate(6, errMessage = '');
    				},
    				8000
    			);

    			return;
    		}

    		if (password != validatePassword) {
    			// Si el email no es correcto
    			$$invalidate(6, errMessage = 'Las contraseñas no coinciden');

    			setTimeout(
    				() => {
    					$$invalidate(6, errMessage = '');
    				},
    				8000
    			);

    			return;
    		}

    		forgot();
    	}

    	// Función para manejar el forgot
    	const forgot = async () => {
    		const response = await fetch('http://127.0.0.1:5000/forgot-password', {
    			method: 'POST',
    			headers: { 'Content-Type': 'application/json' },
    			body: JSON.stringify({
    				email,
    				sex,
    				idnumber,
    				password,
    				typePerson
    			})
    		});

    		const data = await response.json();

    		if (response.ok) {
    			$$invalidate(7, okMessage = data.msg);

    			// Llama a login con los datos registrados
    			setTimeout(
    				async () => {
    					await login(email, password);
    				},
    				3000
    			);
    		} else {
    			$$invalidate(6, errMessage = data.msg);
    		}

    		setTimeout(
    			() => {
    				$$invalidate(6, errMessage = '');
    			},
    			8000
    		);

    		return;
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Forgot> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		typePerson = select_value(this);
    		$$invalidate(0, typePerson);
    	}

    	function select_change_handler_1() {
    		sex = select_value(this);
    		$$invalidate(1, sex);
    	}

    	function input0_input_handler() {
    		idnumber = this.value;
    		$$invalidate(2, idnumber);
    	}

    	function input1_input_handler() {
    		email = this.value;
    		$$invalidate(3, email);
    	}

    	function input2_input_handler() {
    		password = this.value;
    		$$invalidate(4, password);
    	}

    	function input3_input_handler() {
    		validatePassword = this.value;
    		$$invalidate(5, validatePassword);
    	}

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		login,
    		typePerson,
    		sex,
    		idnumber,
    		email,
    		password,
    		validatePassword,
    		errMessage,
    		okMessage,
    		dispatch,
    		handleCloseClick,
    		resetPerson,
    		clickButton,
    		forgot
    	});

    	$$self.$inject_state = $$props => {
    		if ('typePerson' in $$props) $$invalidate(0, typePerson = $$props.typePerson);
    		if ('sex' in $$props) $$invalidate(1, sex = $$props.sex);
    		if ('idnumber' in $$props) $$invalidate(2, idnumber = $$props.idnumber);
    		if ('email' in $$props) $$invalidate(3, email = $$props.email);
    		if ('password' in $$props) $$invalidate(4, password = $$props.password);
    		if ('validatePassword' in $$props) $$invalidate(5, validatePassword = $$props.validatePassword);
    		if ('errMessage' in $$props) $$invalidate(6, errMessage = $$props.errMessage);
    		if ('okMessage' in $$props) $$invalidate(7, okMessage = $$props.okMessage);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		typePerson,
    		sex,
    		idnumber,
    		email,
    		password,
    		validatePassword,
    		errMessage,
    		okMessage,
    		handleCloseClick,
    		resetPerson,
    		clickButton,
    		select_change_handler,
    		select_change_handler_1,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler
    	];
    }

    class Forgot extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Forgot",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.59.2 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    // (122:28) 
    function create_if_block_5(ctx) {
    	let chat;
    	let current;
    	chat = new Chat({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(chat.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(chat, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(chat.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(chat.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(chat, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(122:28) ",
    		ctx
    	});

    	return block;
    }

    // (120:29) 
    function create_if_block_4(ctx) {
    	let forgot;
    	let current;
    	forgot = new Forgot({ $$inline: true });
    	forgot.$on("closeRegister", /*handleCloseRegister*/ ctx[4]);

    	const block = {
    		c: function create() {
    			create_component(forgot.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(forgot, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(forgot.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(forgot.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(forgot, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(120:29) ",
    		ctx
    	});

    	return block;
    }

    // (118:31) 
    function create_if_block_3(ctx) {
    	let register;
    	let current;
    	register = new Register({ $$inline: true });
    	register.$on("closeRegister", /*handleCloseRegister*/ ctx[4]);

    	const block = {
    		c: function create() {
    			create_component(register.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(register, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(register.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(register.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(register, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(118:31) ",
    		ctx
    	});

    	return block;
    }

    // (116:28) 
    function create_if_block_2(ctx) {
    	let login;
    	let current;
    	login = new Login({ $$inline: true });
    	login.$on("closeLogin", /*handleCloseLogin*/ ctx[3]);
    	login.$on("nav", /*changeView*/ ctx[2]);

    	const block = {
    		c: function create() {
    			create_component(login.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(login, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(login.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(login.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(login, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(116:28) ",
    		ctx
    	});

    	return block;
    }

    // (114:27) 
    function create_if_block_1(ctx) {
    	let main;
    	let current;
    	main = new Main({ $$inline: true });
    	main.$on("nav", /*changeView*/ ctx[2]);

    	const block = {
    		c: function create() {
    			create_component(main.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(main, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(main.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(main.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(main, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(114:27) ",
    		ctx
    	});

    	return block;
    }

    // (111:1) {#if loggedIn}
    function create_if_block(ctx) {
    	let chat;
    	let current;
    	chat = new Chat({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(chat.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(chat, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(chat.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(chat.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(chat, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(111:1) {#if loggedIn}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let header;
    	let t0;
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let t1;
    	let div;
    	let onlymob;
    	let t2;
    	let footer;
    	let current;
    	header = new Header({ $$inline: true });
    	header.$on("nav", /*changeView*/ ctx[2]);

    	const if_block_creators = [
    		create_if_block,
    		create_if_block_1,
    		create_if_block_2,
    		create_if_block_3,
    		create_if_block_4,
    		create_if_block_5
    	];

    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*loggedIn*/ ctx[1]) return 0;
    		if (/*view*/ ctx[0] === 'main') return 1;
    		if (/*view*/ ctx[0] === 'login') return 2;
    		if (/*view*/ ctx[0] === 'register') return 3;
    		if (/*view*/ ctx[0] === 'forgot') return 4;
    		if (/*view*/ ctx[0] === 'guest') return 5;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	onlymob = new Onlymob({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    			t0 = space();
    			main = element("main");
    			if (if_block) if_block.c();
    			t1 = space();
    			div = element("div");
    			create_component(onlymob.$$.fragment);
    			t2 = space();
    			create_component(footer.$$.fragment);
    			attr_dev(main, "class", "main svelte-1s4ypch");
    			add_location(main, file, 109, 0, 2801);
    			attr_dev(div, "class", "onlyMob svelte-1s4ypch");
    			add_location(div, file, 126, 0, 3397);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(main, null);
    			}

    			insert_dev(target, t1, anchor);
    			insert_dev(target, div, anchor);
    			mount_component(onlymob, div, null);
    			insert_dev(target, t2, anchor);
    			mount_component(footer, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if (~current_block_type_index) {
    					if_blocks[current_block_type_index].p(ctx, dirty);
    				}
    			} else {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					} else {
    						if_block.p(ctx, dirty);
    					}

    					transition_in(if_block, 1);
    					if_block.m(main, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(onlymob.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(onlymob.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}

    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div);
    			destroy_component(onlymob);
    			if (detaching) detach_dev(t2);
    			destroy_component(footer, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let view = 'main'; // main, login, register o guest
    	let lastview = '';

    	function changeView(event) {
    		$$invalidate(0, view = event.detail.view);

    		if (view == 'guest') {
    			lastview = 'guest';
    		} else if (view == 'main') {
    			lastview = '';
    		}
    	}

    	function handleCloseLogin() {
    		//Si la vista anterior es guest muestra guest sino main
    		if (lastview == 'guest') {
    			$$invalidate(0, view = 'guest');
    		} else {
    			$$invalidate(0, view = 'main');
    		}
    	}

    	function handleCloseRegister() {
    		$$invalidate(0, view = 'login');
    	}

    	let schema = "S";

    	function getSchema() {
    		fetch("./schema").then(c => c.text()).then(c => schema = c);
    	}

    	let userName;
    	let loggedIn;

    	isLoggedIn.subscribe(value => {
    		$$invalidate(1, loggedIn = value);
    	});

    	user.subscribe(value => {
    		userName = value;
    	});

    	// Al cargar el componente, verifica si hay un token guardado
    	onMount(async () => {
    		const storedToken = localStorage.getItem('jwt_token');

    		if (storedToken) {
    			try {
    				const response = await fetch('http://127.0.0.1:5000/protected', {
    					method: 'GET',
    					headers: {
    						'Authorization': `Bearer ${storedToken}`,
    						'Content-Type': 'application/json'
    					}
    				});

    				if (response.ok) {
    					const result = await response.json();
    					token.set(storedToken); // Establece el token en el store
    					let username = result.nombre;
    					user.set(username);
    					userid.set(result.id);
    					isLoggedIn.set(true);
    				} else {
    					// Si el token no es válido o ha expirado, limpiar el localStorage
    					logout();
    				}
    			} catch(error) {
    				console.error("Error al verificar la sesión:", error);
    				logout();
    			}
    		} else {
    			// Si no hay token, asegura que no se considere autenticado
    			isLoggedIn.set(false);
    		}

    		//Reinicia al json al recargar la pagina
    		try {
    			const res = await fetch("http://127.0.0.1:5000/reset-chat-json", {
    				method: "POST",
    				headers: { "Content-Type": "application/json" }
    			});

    			const data = await res.json();
    			console.log("JSON reiniciado:", data.message);
    		} catch(error) {
    			console.error("Error al reiniciar JSON:", error);
    		}
    	});

    	function logout() {
    		//Limpia todo para cerrar la sesion
    		localStorage.removeItem('jwt_token');

    		token.set(null);
    		user.set(null);
    		isLoggedIn.set(false);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Chat,
    		Header,
    		Footer,
    		Main,
    		Onlymob,
    		Login,
    		Register,
    		Forgot,
    		onMount,
    		user,
    		userid,
    		token,
    		isLoggedIn,
    		comment,
    		view,
    		lastview,
    		changeView,
    		handleCloseLogin,
    		handleCloseRegister,
    		schema,
    		getSchema,
    		userName,
    		loggedIn,
    		logout
    	});

    	$$self.$inject_state = $$props => {
    		if ('view' in $$props) $$invalidate(0, view = $$props.view);
    		if ('lastview' in $$props) lastview = $$props.lastview;
    		if ('schema' in $$props) schema = $$props.schema;
    		if ('userName' in $$props) userName = $$props.userName;
    		if ('loggedIn' in $$props) $$invalidate(1, loggedIn = $$props.loggedIn);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [view, loggedIn, changeView, handleCloseLogin, handleCloseRegister];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
