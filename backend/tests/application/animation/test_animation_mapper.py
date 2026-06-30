from app.application.animation.animation_mapper import AnimationMapper


def test_question_segment_maps_to_question_intent():
    mapper = AnimationMapper()

    decision = mapper.map_segment("How does this pipeline keep audio and animation in sync?")

    assert decision.intent == "question"
    assert decision.intent_scores["question"] == max(decision.intent_scores.values())


def test_mapping_is_deterministic_for_same_segment():
    mapper = AnimationMapper()
    text = "This is an important step, and we must keep it stable."

    first = mapper.map_segment(text, previous_intent="transition")
    second = mapper.map_segment(text, previous_intent="transition")

    assert second.intent == first.intent
    assert second.tone == first.tone
    assert second.intent_scores == first.intent_scores
