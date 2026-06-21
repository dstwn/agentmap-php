<?php

namespace TestNS;

use App\Models\User;
use App\Services\UserService as US;

class TestAssignments
{
    public function run()
    {
        // Resolves via use map → App\Models\User
        $user = new User();

        // Static call resolves via use map → App\Services\UserService
        $repo = UserService::getInstance();

        // No use import → stays as "Foo"
        $plain = new Foo();

        // Fully-qualified → App\Models\User (leading backslash stripped)
        $fq = new \Other\NS\Bar();

        // Scalar assignments — must NOT produce assignedTypes entries
        $count = 42;
        $label = "hello";
    }
}
