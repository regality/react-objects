import React, { Component } from 'react';
import { cloneDeep, get, has, includes, isArray, set, toPath, unset } from 'lodash'
import { HistoryWidget, getHistory, getRollbackIndex, addToHistory } from './history'

export function wrapComponent (Component, initialState = {}) {
  return function WrappedComponent (props) {
    return <Wrapper initialState={initialState} addToHistory={addToHistory}>
      <Component {...props} />
      <HistoryWidget history={getHistory()} rollbackIndex={getRollbackIndex()} />
    </Wrapper>
  }
}

export function createMixin(name, mixins) {
  if (typeof name !== 'string') throw new Error('createMixin name must be a string')
  if (typeof mixins !== 'object') throw new Error('createMixin mixins must be an object')
  return function applyMixin(proxy) {
    const { state, path, onStateChange, changeHandlers } = proxy.__private__
    return createProxy({ state, path, onStateChange, changeHandlers, mixins, reasons: [ name ] })
  }
}

class Wrapper extends Component {
  constructor (props) {
    super(props)
    const root = { ...this.props.initialState }
    let nextState
    const onStateChange = (newState, path, cb) => {
      if (!nextState) {
        setImmediate(() => {
          if (cb) cb()
          addToHistory({ event: 'setState', state: nextState, onStateChange })
          const proxy = createProxy({
            state: nextState,
            path: [ 'root' ],
            onStateChange
          })
          this.setState({ proxy })
          nextState = null
        })
      }
      nextState = newState
    }
    const proxy = createProxy({
      state: { root: root },
      path: [ 'root' ],
      onStateChange
    })
    this.state = { proxy }
    addToHistory({ event: 'initial state', action: 'add', path: 'state', val: this.props.initialState })
    addToHistory({ event: 'setState', state: { root: root }, onStateChange })
  }

  render () {
    const children = React.Children.map(this.props.children, child => {
      return React.cloneElement(child, {
        store: this.state.proxy
      })
    })
    return children
  }
}

function createProxy(opts) {
  let {
    state,
    path,
    onStateChange,
    mixins,
    reasons,
    changeHandlers
  } = opts
  reasons = reasons || []
  changeHandlers = changeHandlers || []

  const pointer = get(state, path)
  if (typeof pointer !== 'object' || pointer === null) {
    return pointer
  }

  let proxy = new Proxy(pointer, {
    set: (pointer, prop, val) => {
      const fullPath = [ ...path, ...toPath(prop) ]
      const isAdd = !has(state, fullPath)
      if (isArray(val) && val.length && val[0].__internal__) {
        val = val.map(v => v.__internal__)
      }
      const internalState = val && val.__internal__
      if (internalState) {
        set(state, fullPath, internalState)
      } else {
        set(state, fullPath, val)
      }
      addToHistory({
        event: reasons.join('.'),
        action: isAdd ? 'add' : 'set',
        path: fullPath.slice(1).join('.'),
        val: val
      })
      if (onStateChange) {
        onStateChange(
          state,
          path,
          () => {
            if (mixins && mixins.onChange) {
              mixins.onChange.call(createProxy({
                state,
                path,
                mixins: { ...mixins, onChange: null }
              }))
            }
            changeHandlers.forEach(changeHandler => changeHandler())
          }
        )
      }
      return true
    },
    get: (pointer, prop) => {
      if (prop === '__internal__') {
        return get(state, path)
      } else if (prop === '__private__') {
        return { state, path, onStateChange, changeHandlers }
      } else if (prop === 'json') {
        return () => get(state, path)
      } else if (prop === 'remove') {
        return () => {
          let parentPath = [ ...path ]
          let childPath = parentPath.pop()
          let data = get(state, parentPath)
          let removedData
          if (isArray(data)) {
            let removed = [ ...data ]
            removedData = removed.splice(childPath, 1).pop()
            set(state, parentPath, removed)
          } else {
            removedData = get(state, path)
            unset(state, path)
          }
          addToHistory({
            event: reasons.join('.'),
            action: 'remove',
            path: path.slice(1).join('.')
          })
          if (onStateChange) {
            onStateChange(
              state,
              path,
              () => {
                if (mixins && mixins.onRemove) {
                  mixins.onRemove.call(removedData, path)
                }
                changeHandlers.forEach(changeHandler => changeHandler())
              }
            )
          }
        }
      } else if (mixins && mixins[prop]) {
        return function mixinWrapper () {
          mixins[prop].apply(createProxy({ ...opts, reasons: [ ...reasons, prop ] }), arguments)
        }
      } else {
        const fullPath = [ ...path, ...toPath(prop) ]
        console.log('fullpath', fullPath)
        let childChangeHandlers = [ ...changeHandlers ]
        if (mixins && mixins.onChange) {
          childChangeHandlers.unshift(mixins.onChange.bind(createProxy({
            state,
            path,
            mixins: { ...mixins, onChange: null }
          })))
        }
        return createProxy({
          ...opts,
          path: fullPath,
          changeHandlers: childChangeHandlers,
          mixins: {}
        })
      }
    }
  })

  return proxy
}
