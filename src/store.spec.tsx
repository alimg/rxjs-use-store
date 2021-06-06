import React from 'react'
import { EMPTY, interval, merge, Observable, of } from 'rxjs'
import { delay, map, mapTo, shareReplay, startWith, switchMap } from 'rxjs/operators'
import { create, act } from 'react-test-renderer'
import * as Sinon from 'sinon'

import { defaultComposer, makeStore, useStore } from './store'


describe('useStore basic test', () => {
  const BasicFixture = () => {
    type State = {aNumber: number, aString: string}
    const [actions, state] = useStore(makeStore({aNumber: 0, aString: ""} as State, {
      increment: ($: Observable<any>) => $.pipe(map(() => state => ({...state, aNumber: state.aNumber + 1}))),
      decrement: ($: Observable<any>) => $.pipe(map(() => state => ({...state, aNumber: state.aNumber - 1}))),
      scream: ($: Observable<[string]>) => $.pipe(map(([text]) => state => ({
        ...state, aString: 
        state.aString + text.toUpperCase()}))),
    }))
    return <>
      <div id="div1">{state.aNumber}</div>
      <div id="div2">{state.aString}</div>
      <button id="button1" onClick={actions.increment}>+1</button>
      <button id="button2" onClick={actions.decrement}>-1</button>
      <button id="button3" onClick={() => actions.scream("aaaaa")}>AAAAA</button>
    </>
  }

  it('should update state when actions are called', () => {
    
    const fixtureNode = <BasicFixture/>
    const testRenderer = create(fixtureNode)
    act(() => testRenderer.update(fixtureNode))

    const button1 = testRenderer.root.find((node) => node.props.id === 'button1')
    const button2 = testRenderer.root.find((node) => node.props.id === 'button2')
    const button3 = testRenderer.root.find((node) => node.props.id === 'button3')
    const div1 = testRenderer.root.find((node) => node.props.id === 'div1')
    const div2 = testRenderer.root.find((node) => node.props.id === 'div2')

    expect(div1.children).toEqual(["0"])
    expect(div2.children).toEqual([""])

    act(() => {
      button1.props.onClick()
      testRenderer.update(fixtureNode)
    })

    expect(div1.children).toEqual(["1"])
    expect(div2.children).toEqual([""])

    act(() => {
      button2.props.onClick()
      button3.props.onClick()
      testRenderer.update(fixtureNode)
    })

    expect(div1.children).toEqual(["0"])
    expect(div2.children).toEqual(["AAAAA"])
  })
})

describe.each(["outputComposer", "outputAction"])('useStore %s specs', (actionType) => {
  type MyFormData = {name?: string, email?: string}
  const validateFormAsync = ({email}: MyFormData) =>
    of(/^\S+@\S+$/.test(email || "")).pipe(delay(1000))
  
  function MyFormComponent(props: {onSubmit?: (formData: MyFormData) => void}) {
    type FormState = MyFormData & {valid?: boolean}
    const [actions, state] = useStore(makeStore({} as FormState, {
        setName: ($: Observable<[string]>) => $.pipe(
          map(([name]) => (state: FormState) => ({...state, name}))),
        setEmail: ($: Observable<[string]>) => $.pipe(
          map(([email]) => (state: FormState) => ({...state, email})))
      }, actionType === "outputComposer" ? {
        outputComposer: (reducer$, initialState) => {
          const formState$ = defaultComposer(reducer$, initialState)
          return formState$.pipe(
            switchMap(state => validateFormAsync(state).pipe(
              startWith(false),
              map((valid) => ({...state, valid})))));
        }
      } : {
        outputAction: ($) => $.pipe(
          switchMap(state => validateFormAsync(state).pipe(
            startWith(false),
            map((valid) => (latest: FormState) => ({...latest, valid})))))
      }))

    return <>
      <div>
        Name: <input onChange={e => actions.setName(e.target.value)} value={state.name} name="name"/>
      </div>
      <div style={{color: state.valid ? "green" : "red", fontWeight: "bold"}}>
        Email: <input onChange={e => actions.setEmail(e.target.value)} value={state.email} name="email"/>
      </div>
      <button onClick={() => props.onSubmit?.(state)} disabled={!state.valid} name="submit">Submit</button>
    </>
  }

  it('should update state with async validation', () => {
    const timer = Sinon.useFakeTimers()
    const fixtureNode = <MyFormComponent/>
    const testRenderer = create(fixtureNode)

    act(() => testRenderer.update(fixtureNode))
    
    const nameInput = testRenderer.root.find((node) => node.props.name === 'name')
    const emailInput = testRenderer.root.find((node) => node.props.name === 'email')
    const submitButton = testRenderer.root.find((node) => node.props.name === 'submit')

    expect(nameInput.props.value).toEqual(undefined)
    expect(emailInput.props.value).toEqual(undefined)
    expect(submitButton.props.disabled).toEqual(true)
    
    act(() => {
      nameInput.props.onChange({ target: { value: 'Bob Ross' }})
      testRenderer.update(fixtureNode)
    })
    expect(nameInput.props.value).toEqual('Bob Ross')
    expect(submitButton.props.disabled).toEqual(true)
    
    act(() => {
      emailInput.props.onChange({ target: { value: 'bob' }})
      testRenderer.update(fixtureNode)
    })
    expect(nameInput.props.value).toEqual('Bob Ross')
    expect(emailInput.props.value).toEqual('bob')
    expect(submitButton.props.disabled).toEqual(true)

    act(() => {
      emailInput.props.onChange({ target: { value: 'bob@ross' }})
      testRenderer.update(fixtureNode)
    })
    expect(nameInput.props.value).toEqual('Bob Ross')
    expect(emailInput.props.value).toEqual('bob@ross')
    expect(submitButton.props.disabled).toEqual(true)

    act(() => {
      timer.tick(1000)
      testRenderer.update(fixtureNode)
    })
    expect(nameInput.props.value).toEqual('Bob Ross')
    expect(emailInput.props.value).toEqual('bob@ross')
    expect(submitButton.props.disabled).toEqual(false)
  })
})

describe('useStore test stories', () => {
  type State = {a: number, b: string}
  function createFixture(externalInput$?: Observable<(state: State) => State>) {
    return function Fixture(props: {id: string, independentProp?: string}) {
    const aStore = makeStore({a: 1, b: props.id} as State, {
        incrementA: ($: Observable<any>) => $.pipe(mapTo((state) => ({...state, a: state.a + 1}))),
        // do something async with the parameter value
        updateB: ($: Observable<[string]>) => $.pipe(
          map(([value]) => (state: State) => ({...state, b: value})),
          delay(1000))
      },
      {
        inputAction: (input$: Observable<[string]>) => merge(
          externalInput$ || EMPTY,
          input$.pipe(map(([id]) => (s: State) => ({...s, b: id}))))
      }
    )

    const [actions, state] = useStore(aStore, [props.id])
    return (
        <>
          <h1 id="id">{props.id}</h1>
          <h2 id="tagA">{state.a}</h2>
          <h2 id="tagB">{state.b}</h2>
          <button id="buttonA" onClick={actions.incrementA}>click me</button>
          <button id="buttonB" onClick={() => actions.updateB(state.b + "A")}>click me</button>
        </>
      )
    }
  }


  it('should respond to clicks', () => {
    const timer = Sinon.useFakeTimers()
    const Fixture = createFixture()
    const fixtureNode = <Fixture id="1" />
    const testRenderer = create(fixtureNode)
    act(() => testRenderer.update(fixtureNode))
    
    const buttonA = testRenderer.root.find((node) => node.props.id === 'buttonA')
    const buttonB = testRenderer.root.find((node) => node.props.id === 'buttonB')
    const tagA = testRenderer.root.find((node) => node.props.id === 'tagA')
    const tagB = testRenderer.root.find((node) => node.props.id === 'tagB')

    expect(tagA.children).toEqual(["1"])
    expect(tagB.children).toEqual(["1"])
    
    act(() => {
      buttonA.props.onClick()
      testRenderer.update(fixtureNode)
    })  
    expect(tagA.children).toEqual(["2"])
    expect(tagB.children).toEqual(["1"])


    act(() => {
      buttonB.props.onClick()
      timer.tick(500)
      testRenderer.update(fixtureNode)
    })
    expect(tagA.children).toEqual(["2"])
    expect(tagB.children).toEqual(["1"])

    act(() => {
      timer.tick(500)
      testRenderer.update(fixtureNode)
    })
    expect(tagA.children).toEqual(["2"])
    expect(tagB.children).toEqual(["1A"])


    // update a dependent prop
    act(() => { testRenderer.update(<Fixture id="2"/>)})

    const id = testRenderer.root.find((node) => node.props.id === 'id')
    expect(id.children).toEqual(["2"])
    expect(tagA.children).toEqual(["2"])
    expect(tagB.children).toEqual(["2"])

    act(() => {      
      buttonA.props.onClick()
      testRenderer.update(<Fixture id="2"/>)
    })
    expect(tagA.children).toEqual(["3"])
    expect(tagB.children).toEqual(["2"])
    act(() => {      
      buttonA.props.onClick()
      buttonB.props.onClick()
      testRenderer.update(<Fixture id="2"/>)
    })

    expect(tagA.children).toEqual(["4"])
    expect(tagB.children).toEqual(["2"])

    act(() => {
      timer.tick(1000)
      testRenderer.update(<Fixture id="2"/>)
    })
    expect(tagA.children).toEqual(["4"])
    expect(tagB.children).toEqual(["2A"])
    
  })
  
  it("should work with an external input", () => {
    const timer = Sinon.useFakeTimers()
    const counter$ = interval(1000).pipe(
      map((t) => (s: State) => ({...s, a: t})))
    const Fixture = createFixture(counter$)
    const fixtureNode = <Fixture id="1" />
    const testRenderer = create(fixtureNode)
    act(() => testRenderer.update(fixtureNode))
    
    const tagA = testRenderer.root.find((node) => node.props.id === 'tagA')
    const tagB = testRenderer.root.find((node) => node.props.id === 'tagB')

    expect(tagA.children).toEqual(["1"])
    expect(tagB.children).toEqual(["1"])
    
    act(() => {
      timer.tick(1000)
      testRenderer.update(fixtureNode)
    })  
    expect(tagA.children).toEqual(["0"])
    expect(tagB.children).toEqual(["1"])

    act(() => {
      timer.tick(1000)
      testRenderer.update(fixtureNode)
    })  
    expect(tagA.children).toEqual(["1"])
    expect(tagB.children).toEqual(["1"])

    // publish a new input
    act(() => testRenderer.update(<Fixture id="2" />))
    act(() => {
      timer.tick(1000)
      testRenderer.update(<Fixture id="2" />)
    })  
    expect(tagA.children).toEqual(["2"])
    expect(tagB.children).toEqual(["2"])

    act(() => {
      timer.tick(1000)
      testRenderer.update(<Fixture id="2" />)
    })  
    expect(tagA.children).toEqual(["3"])
    expect(tagB.children).toEqual(["2"])

    // updating the other props does not reset the subscription
    act(() => {
      timer.tick(1000)
      testRenderer.update(<Fixture id="2" independentProp="hello" />)
    })  
    expect(tagA.children).toEqual(["4"])
    expect(tagB.children).toEqual(["2"])
  })

  it("should work with a external input after rebinding", () => {
    const timer = Sinon.useFakeTimers()
    const counter$ = interval(1000).pipe(
      map((t) => (s: State) => ({...s, a: t})),
      // using share replay to remember last emitted value when the props are changed
      shareReplay(1))
    const Fixture = createFixture(counter$)
    const fixtureNode = <Fixture id="1" />
    const testRenderer = create(fixtureNode)
    act(() => testRenderer.update(fixtureNode))
    
    const tagA = testRenderer.root.find((node) => node.props.id === 'tagA')
    const tagB = testRenderer.root.find((node) => node.props.id === 'tagB')

    expect(tagA.children).toEqual(["1"])
    expect(tagB.children).toEqual(["1"])
    
    act(() => {
      timer.tick(1000)
      testRenderer.update(fixtureNode)
    })  
    expect(tagA.children).toEqual(["0"])
    expect(tagB.children).toEqual(["1"])

    act(() => {
      timer.tick(1000)
      testRenderer.update(fixtureNode)
    })  
    expect(tagA.children).toEqual(["1"])
    expect(tagB.children).toEqual(["1"])

    // removing the node
    act(() => {
      testRenderer.update( <div/>)
    })  
    // now add the node with new props and assert that the counter is preserved
    {
      act(() => {
        timer.tick(1000)
        testRenderer.update( <Fixture id="2" />)
      })
      
      const tagA = testRenderer.root.find((node) => node.props.id === 'tagA')
      const tagB = testRenderer.root.find((node) => node.props.id === 'tagB')
      
      expect(tagA.children).toEqual(["2"])
      expect(tagB.children).toEqual(["2"])

      act(() => {
        timer.tick(1000)
        testRenderer.update( <Fixture id="2" />)
      })  
      expect(tagA.children).toEqual(["3"])
      expect(tagB.children).toEqual(["2"])
    }
  })


});
