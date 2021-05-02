import React from "react"
import ReactDOM from 'react-dom'
import { CorvidPicker } from "./corvid-picker"
import { FormExample } from "./form-validation"
import { StopWatch } from "./stop-watch"


function App() {
  return (
  <div className="content">
    <h1>Form with validation</h1>
    <FormExample onSubmit={(data) => alert(JSON.stringify(data))}/>
    <h1>Stopwatch</h1>
    <StopWatch/>
    <h1>Autocomplete example</h1>
    <CorvidPicker/>
  </div>
  )
}

ReactDOM.render(<App />, document.querySelector('#root'))
