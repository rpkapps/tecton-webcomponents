import { defineElement } from "../../internal/define.js"
import "../button/define.js"
import { TecQuestionnaire } from "./questionnaire.js"
import { TecQuestionnaireChoice, TecQuestionnaireChoiceDescription, TecQuestionnaireInput } from "./questionnaire-choice.js"
import {
  TecQuestionnaireChoices,
  TecQuestionnaireDescription,
  TecQuestionnaireError,
  TecQuestionnaireItem,
  TecQuestionnaireTitle,
} from "./questionnaire-item.js"
import {
  TecQuestionnaireActions,
  TecQuestionnaireNext,
  TecQuestionnairePrevious,
  TecQuestionnaireProgress,
  TecQuestionnaireSkip,
  TecQuestionnaireSubmit,
} from "./questionnaire-nav.js"

// The questionnaire and its items are defined before the parts they drive.
defineElement("tec-questionnaire", TecQuestionnaire)
defineElement("tec-questionnaire-item", TecQuestionnaireItem)
defineElement("tec-questionnaire-progress", TecQuestionnaireProgress)
defineElement("tec-questionnaire-title", TecQuestionnaireTitle)
defineElement("tec-questionnaire-description", TecQuestionnaireDescription)
defineElement("tec-questionnaire-choices", TecQuestionnaireChoices)
defineElement("tec-questionnaire-choice", TecQuestionnaireChoice)
defineElement("tec-questionnaire-choice-description", TecQuestionnaireChoiceDescription)
defineElement("tec-questionnaire-input", TecQuestionnaireInput)
defineElement("tec-questionnaire-error", TecQuestionnaireError)
defineElement("tec-questionnaire-actions", TecQuestionnaireActions)
defineElement("tec-questionnaire-previous", TecQuestionnairePrevious)
defineElement("tec-questionnaire-skip", TecQuestionnaireSkip)
defineElement("tec-questionnaire-next", TecQuestionnaireNext)
defineElement("tec-questionnaire-submit", TecQuestionnaireSubmit)

export {
  TecQuestionnaire,
  TecQuestionnaireActions,
  TecQuestionnaireChoice,
  TecQuestionnaireChoiceDescription,
  TecQuestionnaireChoices,
  TecQuestionnaireDescription,
  TecQuestionnaireError,
  TecQuestionnaireInput,
  TecQuestionnaireItem,
  TecQuestionnaireNext,
  TecQuestionnairePrevious,
  TecQuestionnaireProgress,
  TecQuestionnaireSkip,
  TecQuestionnaireSubmit,
  TecQuestionnaireTitle,
}
