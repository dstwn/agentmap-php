<?php
namespace Chains;

class Step4A
{
    public function x(): Step4B
    {
        return new Step4B();
    }
}
