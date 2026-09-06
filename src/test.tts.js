// test-tts.js — run manually with `node test-tts.js`, delete when done testing
import fs from "fs";
import { synthesizeDialogueAudio } from "./services/ai/artifact/synthesizeDialogueAudio.service.js";

const dialogue = [
    {
        "speaker": "Host 1",
        "text": "Welcome back to our podcast! Today, we're diving into the intense drama of House of the Dragon Season 3 Episode 8. What a rollercoaster! Aegon and Aemond are back, and it feels like the stakes have never been higher. What do you think, is this the turning point we've been waiting for?",
        "tone": "enthusiastic",
        "ai_instruction": "Speak quickly with genuine excitement, slight pause before 'turning point' for effect."
    },
    {
        "speaker": "Host 2",
        "text": "Absolutely! This episode is packed with significant developments. Aegon's return alongside Aemond and the dramatic reappearance of Sunfyre really sets the stage. It’s not just about their return; it’s about how it shifts the power dynamics in King's Landing. Rhaenyra seems to be struggling with her authority, despite controlling six dragons.",
        "tone": "analytical",
        "ai_instruction": "Speak steadily with a measured tone, emphasizing 'six dragons' to highlight Rhaenyra's power."
    },
    {
        "speaker": "Host 1",
        "text": "Right! It’s almost like she’s forgotten the power she holds. Instead of leveraging her dragons, she’s caught up in omens and public unrest. It’s like having a superhero cape but choosing to walk instead of fly! Why do you think she’s hesitating?",
        "tone": "curious",
        "ai_instruction": "Speak with a curious tone, emphasizing 'superhero cape' to draw a vivid analogy."
    },
    {
        "speaker": "Host 2",
        "text": "That’s a great analogy! Rhaenyra’s inner turmoil is palpable. She’s torn between her responsibilities and the chaos around her. The citizens are suffering, and Daemon’s indifference to the Faith of the Seven only complicates things further. It’s a classic case of leadership under pressure.",
        "tone": "analytical",
        "ai_instruction": "Speak thoughtfully, with a slight pause after 'leadership under pressure' for emphasis."
    },
    {
        "speaker": "Host 1",
        "text": "Exactly! And then we have the tension with Baela accusing Rhaenyra of using people for her advantage. It’s like a family feud on a grand scale, where personal grievances are intertwined with political maneuvering. How do you see that playing out?",
        "tone": "enthusiastic",
        "ai_instruction": "Speak with rising excitement, emphasizing 'family feud' to highlight the drama."
    },
    {
        "speaker": "Host 2",
        "text": "It’s a dangerous game. Rhaenyra’s actions, especially in the Small Council, show her willingness to silence dissent. Choosing Daemon over Mysaria could alienate potential allies. It’s a risky strategy that could backfire, especially with the public already restless.",
        "tone": "analytical",
        "ai_instruction": "Speak clearly and deliberately, emphasizing 'risky strategy' to underline the stakes."
    },
    {
        "speaker": "Host 1",
        "text": "And then we dive into Rhaenyra’s cruelty. Force-feeding Helaena and killing High Septon Eustace? That’s a serious escalation! It’s like she’s crossed a line that can’t be uncrossed. What does that mean for her legitimacy?",
        "tone": "inquisitive",
        "ai_instruction": "Speak with a concerned tone, emphasizing 'crossed a line' to convey the gravity of the situation."
    },
    {
        "speaker": "Host 2",
        "text": "It’s catastrophic for her political standing. Attacking the Faith of the Seven is a bold move, one that even Aegon the Conqueror wouldn’t have dared. The citizens are starving, and Rhaenyra’s actions could lead to long-lasting resentment. It’s a classic case of losing the moral high ground.",
        "tone": "analytical",
        "ai_instruction": "Speak with a serious tone, emphasizing 'moral high ground' to highlight the consequences."
    },
    {
        "speaker": "Host 1",
        "text": "And let’s not forget Helaena’s tragic jump! The connection between her tapestry and her fate is haunting. It’s like a prophecy unfolding right before our eyes. What do you think drove her to that point?",
        "tone": "reflective",
        "ai_instruction": "Speak slowly and thoughtfully, emphasizing 'haunting' to convey the emotional weight."
    },
    {
        "speaker": "Host 2",
        "text": "Helaena’s situation is tragic indeed. Rhaenyra’s manipulation of her dreamer abilities shows a desperate attempt to control the narrative. The jump symbolizes her breaking point, and it’s a stark contrast to the books, where her motivations are tied to her son’s death. It’s a powerful visual representation of despair.",
        "tone": "analytical",
        "ai_instruction": "Speak with a somber tone, emphasizing 'powerful visual representation' to convey the impact."
    },
    {
        "speaker": "Host 1",
        "text": "And then we have the chaos of the Battle of Tumbleton! The political maneuvering leading up to it is just as intense as the battle itself. Bolt Jon’s heroics and the betrayal of Silverwing add layers to the conflict. How do you see this affecting Rhaenyra’s forces moving forward?",
        "tone": "enthusiastic",
        "ai_instruction": "Speak with excitement, emphasizing 'chaos of the Battle' to capture the action."
    },
    {
        "speaker": "Host 2",
        "text": "This battle marks a significant turning point. Rhaenyra’s side is losing trust in their dragonriders, which could lead to strategic disarray. The loss of reliable support from dragons is a game-changer. It’s a pivotal moment in the Dance of the Dragons, and the implications are huge.",
        "tone": "analytical",
        "ai_instruction": "Speak with urgency, emphasizing 'pivotal moment' to highlight the significance."
    },
    {
        "speaker": "Host 1",
        "text": "And we can’t overlook Aemond’s guilt and the Harrenhal revelations. Alicent’s backstory adds depth to the characters and sets the stage for Aemond’s reconciliation with Aegon. Do you think this will solidify their alliance or create more tension?",
        "tone": "curious",
        "ai_instruction": "Speak with a curious tone, emphasizing 'solidify their alliance' to provoke thought."
    },
    {
        "speaker": "Host 2",
        "text": "It’s a double-edged sword. While Aemond’s public plea for forgiveness could strengthen their bond, the conditions Aegon sets for forgiveness could lead to further conflict. The stakes are incredibly high, especially with the 'Prince That Was Promised' revelation now public. It’s a volatile situation.",
        "tone": "analytical",
        "ai_instruction": "Speak with a serious tone, emphasizing 'volatile situation' to convey the tension."
    },
    {
        "speaker": "Host 1",
        "text": "What a complex web of intrigue! It’s clear that the fallout from this episode will resonate throughout the series. We can’t wait to see how these threads unravel in the next episodes. Thanks for joining us today!",
        "tone": "enthusiastic",
        "ai_instruction": "Speak with a warm tone, emphasizing 'complex web of intrigue' to wrap up the discussion."
    },
    {
        "speaker": "Host 2",
        "text": "Absolutely! Don’t forget to like, subscribe, and share your thoughts in the comments. We want to hear what you think about Rhaenyra’s choices and the future of the Targaryen legacy. Until next time!",
        "tone": "enthusiastic",
        "ai_instruction": "Speak quickly with excitement, emphasizing 'like, subscribe' to encourage audience engagement."
    }
]

const results = await synthesizeDialogueAudio(dialogue);

fs.mkdirSync("./test-output", { recursive: true });

results.forEach((r, i) => {
    fs.writeFileSync(`./test-output/line-${i}-${r.speaker.replace(" ", "")}.mp3`, r.buffer);
});

console.log("Done — check ./test-output/");