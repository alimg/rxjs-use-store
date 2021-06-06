import React from "react"
import { Observable, of } from "rxjs"
import { delay, map, startWith, switchMap } from "rxjs/operators"
import { useStore } from "../src/store"

export type FormData = {name?: string, email?: string}

const validateFormAsync = ({email}: FormData) =>
  of(/^\S+@\S+$/.test(email || "")).pipe(delay(1000))

export function FormExample(props: {onSubmit: (formData: FormData) => void}) {
  type FormState = FormData & {valid?: boolean}
  const [actions, state] = useStore({
    initialState: {valid: false} as FormState, 
    actions: {
      setName: ($: Observable<[name: string]>) => $.pipe(
        map(([name]) => (state: FormState) => ({...state, name}))),
      setEmail: ($: Observable<[email: string]>) => $.pipe(
        map(([email]) => (state: FormState) => ({...state, email})))
    },
    outputAction: ($) => $.pipe(      
      switchMap(state => validateFormAsync(state).pipe(      
          startWith(undefined),      
          map((valid) => (latest: FormState) => ({...latest, valid})))))  })
  return <>
    <div>
      Name: <input onChange={e => actions.setName(e.target.value)} value={state.name}/>
    </div>
    <div className={state.valid ? "valid" : state.valid === undefined ?  "" : "invalid"}>
      Email: <input onChange={e => actions.setEmail(e.target.value)} value={state.email}/>
    </div>
    <button onClick={() => props.onSubmit(state)} disabled={!state.valid}>
      {state.valid === undefined ? "Validating..." : "Submit"}
    </button>
  </>
}