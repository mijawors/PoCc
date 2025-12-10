
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { HumanMessage } from "@langchain/core/messages";

async function test() {
    try {
        const model = new HuggingFaceInference({
            apiKey: "hf_...", // Dummy key, we just want to check type compatibility/runtime error before API call
            model: "mistralai/Mistral-7B-Instruct-v0.3",
        });

        const messages = [new HumanMessage("Hello")];
        console.log("Invoking with messages...");
        // @ts-ignore
        await model.invoke(messages);
        console.log("Invoke successful (or at least reached API call)");
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}

test();
